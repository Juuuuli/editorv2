import { WorkspaceMode } from './WorkspaceManager.js';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import { fabric } from 'fabric';

export default class ExportManager {
    constructor(canvasEngine, eventBus, workspaceManager) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;
        this.workspaceManager = workspaceManager;
        
        this.bindEvents();
    }
    
    bindEvents() {
        const btnDropdown = document.getElementById('btn-export-dropdown');
        const optionsMenu = document.getElementById('export-options');
        
        if (btnDropdown && optionsMenu) {
            btnDropdown.addEventListener('click', () => {
                optionsMenu.classList.toggle('hidden');
            });
            
            document.addEventListener('click', (e) => {
                if (!btnDropdown.contains(e.target) && !optionsMenu.contains(e.target)) {
                    optionsMenu.classList.add('hidden');
                }
            });
        }

        // 全域委派處理所有 [data-export-type] 按鈕點擊 (包含頂部選單與使用者頭像選單)
        document.addEventListener('click', (e) => {
            const exportBtn = e.target.closest('[data-export-type]');
            if (exportBtn) {
                document.querySelectorAll('#export-options, #editor-user-dropdown').forEach(el => el.classList.add('hidden'));
                const type = exportBtn.dataset.exportType;
                if (type) {
                    this.handleExport(type);
                }
            }
        });
        
        // Modal events
        const btnWarnClose = document.getElementById('btn-export-warn-close');
        const btnWarnCancel = document.getElementById('btn-export-warn-cancel');
        const btnWarnConfirm = document.getElementById('btn-export-warn-confirm');
        const modalWarn = document.getElementById('modal-export-warning');
        
        const closeModal = () => {
            if (modalWarn) modalWarn.classList.add('hidden');
        };
        
        if (btnWarnClose) btnWarnClose.addEventListener('click', closeModal);
        if (btnWarnCancel) btnWarnCancel.addEventListener('click', closeModal);
        if (btnWarnConfirm) {
            btnWarnConfirm.addEventListener('click', () => {
                const noWarn = document.getElementById('checkbox-export-no-warn').checked;
                if (noWarn) {
                    localStorage.setItem('hidePdfExportWarning', 'true');
                }
                closeModal();
                this.executeExportImage();
            });
        }
    }
    
    handleExport(type) {
        switch (type) {
            case 'json':
                this.exportJSON();
                break;
            case 'image':
                this.exportImage();
                break;
            case 'pdf':
                this.exportPDF();
                break;
            case 'ppt':
                this.exportPPT();
                break;
        }
    }
    
    exportJSON() {
        this.canvasEngine.savePageState();
        const titleEl = document.getElementById('current-project-title-display');
        const projName = titleEl ? titleEl.textContent.trim() : '專案';
        const isPdf = this.workspaceManager ? this.workspaceManager.currentMode === WorkspaceMode.PDF : true;
        const width = this.canvasEngine.artboard ? this.canvasEngine.artboard.width : 1280;
        const height = this.canvasEngine.artboard ? this.canvasEngine.artboard.height : 720;
        const pageIds = Object.keys(this.canvasEngine.pageStates || {});

        const projectData = {
            version: '1.2.1',
            name: projName,
            type: isPdf ? 'PDF' : 'IMAGE',
            dimension: {
                width: width,
                height: height,
                ratio: `${width}:${height}`
            },
            currentPageId: this.canvasEngine.currentPageId || pageIds[0],
            pageStates: this.canvasEngine.pageStates,
            pageSizes: this.canvasEngine.pageSizes || {},
            pages: pageIds.map((pid, idx) => ({ id: pid, active: pid === this.canvasEngine.currentPageId, thumbnail: null })),
            updatedAt: Date.now(),
            createdAt: Date.now()
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${projName}.editorproj`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
    
    exportImage() {
        const isPdfMode = this.workspaceManager.currentMode === WorkspaceMode.PDF;
        const hideWarning = localStorage.getItem('hidePdfExportWarning') === 'true';
        
        if (isPdfMode && !hideWarning) {
            const modal = document.getElementById('modal-export-warning');
            if (modal) {
                modal.classList.remove('hidden');
                return;
            }
        }
        
        this.executeExportImage();
    }
    
    executeExportImage() {
        // 先取消選取，避免外框被匯出
        this.canvasEngine.canvas.discardActiveObject();
        this.canvasEngine.canvas.requestRenderAll();
        
        const artboard = this.canvasEngine.artboard;
        if (!artboard) return;
        
        // 暫存當前視角並歸零 (避免擷取到平移或縮放偏移的畫面)
        const originalVpt = this.canvasEngine.canvas.viewportTransform.slice();
        this.canvasEngine.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        
        const dataUrl = this.canvasEngine.canvas.toDataURL({
            format: 'png',
            left: artboard.left,
            top: artboard.top,
            width: artboard.width,
            height: artboard.height,
            multiplier: 2 // 高解析度
        });

        // 恢復視角
        this.canvasEngine.canvas.setViewportTransform(originalVpt);
        
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataUrl);
        downloadAnchorNode.setAttribute("download", "export.png");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
    
    async getRenderedPagesDataUrls() {
        this.canvasEngine.savePageState(); // 確保當前頁面有存入 pageStates
        const states = this.canvasEngine.pageStates;
        const pageIds = Object.keys(states);
        
        const dataUrls = [];
        
        // 建立一個背景的 StaticCanvas 來進行渲染 (不影響畫布)
        const artboard = this.canvasEngine.artboard;
        const width = artboard ? artboard.width : 800;
        const height = artboard ? artboard.height : 450;
        
        const tempCanvasEl = document.createElement('canvas');
        tempCanvasEl.width = width;
        tempCanvasEl.height = height;
        
        const tempCanvas = new fabric.StaticCanvas(tempCanvasEl, {
            width: width,
            height: height
        });
        
        for (const pageId of pageIds) {
            const savedData = states[pageId];
            if (!savedData) continue;
            
            await new Promise((resolve) => {
                tempCanvas.clear();
                // Add a white background manually to tempCanvas
                const bg = new fabric.Rect({
                    left: 0, top: 0, width: width, height: height, fill: '#ffffff', selectable: false
                });
                tempCanvas.add(bg);

                if (savedData.length === 0) {
                    resolve();
                } else {
                    fabric.util.enlivenObjects(savedData, (objs) => {
                        objs.forEach(obj => {
                            tempCanvas.add(obj);
                        });
                        
                        tempCanvas.renderAll();
                        
                        const dataUrl = tempCanvas.toDataURL({
                            format: 'jpeg',
                            quality: 0.9,
                            left: 0,
                            top: 0,
                            width: width,
                            height: height,
                            multiplier: 2
                        });
                        
                        dataUrls.push(dataUrl);
                        resolve();
                    });
                }
            });
        }
        
        tempCanvas.dispose();
        return { dataUrls, width, height };
    }
    
    async exportPDF() {
        this.eventBus.emit('LOADING:START', { message: '正在產生 PDF，請稍候...' });
        try {
            const { dataUrls, width, height } = await this.getRenderedPagesDataUrls();
            if (dataUrls.length === 0) return;
            
            // 決定 PDF 的方向
            const orientation = width > height ? 'l' : 'p';
            
            // 使用 jsPDF
            const PDFClass = jsPDF.jsPDF || jsPDF;
            const doc = new PDFClass({
                orientation: orientation,
                unit: 'px',
                format: [width, height]
            });
            
            dataUrls.forEach((dataUrl, index) => {
                if (index > 0) {
                    doc.addPage([width, height], orientation);
                }
                doc.addImage(dataUrl, 'JPEG', 0, 0, width, height);
            });
            
            doc.save('project.pdf');
        } catch (e) {
            console.error("PDF 匯出失敗", e);
            alert("匯出 PDF 時發生錯誤: " + (e.message || e));
        } finally {
            this.eventBus.emit('LOADING:END');
        }
    }
    
    async exportPPT() {
        this.eventBus.emit('LOADING:START', { message: '正在產生 PPTX，請稍候...' });
        try {
            const { dataUrls, width, height } = await this.getRenderedPagesDataUrls();
            if (dataUrls.length === 0) return;
            
            // 使用 pptxgenjs
            const PptxClass = pptxgen.default || pptxgen;
            const pres = new PptxClass();
            
            // 定義投影片尺寸 (以英吋為單位，假設 96 DPI)
            pres.defineLayout({ name: 'CUSTOM', width: width / 96, height: height / 96 });
            pres.layout = 'CUSTOM';
            
            dataUrls.forEach((dataUrl) => {
                const slide = pres.addSlide();
                slide.addImage({ data: dataUrl, x: 0, y: 0, w: width / 96, h: height / 96 });
            });
            
            await pres.writeFile({ fileName: 'project.pptx' });
        } catch (e) {
            console.error("PPTX 匯出失敗", e);
            alert("匯出 PPTX 時發生錯誤: " + (e.message || e));
        } finally {
            this.eventBus.emit('LOADING:END');
        }
    }
}
