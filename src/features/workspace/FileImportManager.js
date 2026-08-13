import { fabric } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import ApiVaultManager from '../vault/ApiVaultManager.js';
import RetinaRenderer from '../canvas_auxiliary/RetinaRenderer.js';
import FirebaseProvider from '../collaboration/FirebaseProvider.js';

// 初始化 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default class FileImportManager {
    constructor(canvasEngine, eventBus, workspaceManager) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;
        this.workspaceManager = workspaceManager;

        this.bindEvents();
    }

    bindEvents() {
        const btnImport = document.getElementById('btn-import-project');
        const inputImport = document.getElementById('input-import-project');

        if (btnImport && inputImport) {
            // 變更按鈕文字
            btnImport.innerHTML = '<i class="fas fa-file-import"></i> 匯入';

            btnImport.addEventListener('click', () => {
                // 支援專案檔、圖片、PDF 與 PPT
                inputImport.setAttribute('accept', '.editorproj,.json,image/*,.pdf,.ppt,.pptx');
                inputImport.click();
            });

            inputImport.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                this.handleFileImport(file);
                e.target.value = ''; // 清空
            });
        }
    }

    async handleFileImport(file) {
        const fileType = file.type;
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.editorproj') || fileName.endsWith('.json') || fileType === 'application/json') {
            await this.importProject(file);
        } else if (fileType.startsWith('image/')) {
            await this.importImage(file);
        } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
            await this.importPDF(file);
        } else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx') || fileType.includes('presentation')) {
            await this.importPPT(file);
        } else {
            alert("不支援的檔案格式！請選擇 .editorproj, .json, .pdf, .pptx 或圖片檔案。");
        }
    }

    async importProject(file) {
        this.eventBus.emit('LOADING:START', { message: '正在匯入專案檔案...' });
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const rawText = e.target.result;
                    const project = JSON.parse(rawText);
                    
                    let pageStates = project.pageStates;
                    if (!pageStates) {
                        if (project.objects && Array.isArray(project.objects)) {
                            pageStates = { 'page-1': project.objects };
                        } else if (Array.isArray(project)) {
                            pageStates = { 'page-1': project };
                        }
                    }
                    if (!pageStates || typeof pageStates !== 'object' || Object.keys(pageStates).length === 0) {
                        throw new Error('專案檔案缺少有效的畫布頁面資料');
                    }

                    const pageIds = Object.keys(pageStates);
                    this.canvasEngine.pageStates = pageStates;
                    this.canvasEngine.pageSizes = project.pageSizes || {};

                    const targetPageId = project.currentPageId || pageIds[0];
                    this.canvasEngine.currentPageId = targetPageId;

                    if (project.name) {
                        const titleEl = document.getElementById('current-project-title-display');
                        if (titleEl) titleEl.textContent = project.name;
                    }

                    if (project.type === 'IMAGE') {
                        this.workspaceManager.setMode('IMAGE');
                    } else {
                        this.workspaceManager.setMode('PDF');
                    }

                    if (project.dimension && project.dimension.width && project.dimension.height) {
                        this.canvasEngine.resizeArtboard(project.dimension.width, project.dimension.height);
                    }

                    this.eventBus.emit('PROJECT:IMPORTED', {
                        projectData: {
                            pageStates: pageStates,
                            currentPageId: targetPageId
                        }
                    });
                    this.eventBus.emit('PAGE:SWITCH', { newPageId: targetPageId });
                    this.canvasEngine.saveHistory();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                } catch (err) {
                    console.error('[FileImportManager] 匯入專案失敗:', err);
                    alert('專案匯入失敗: ' + err.message);
                } finally {
                    this.eventBus.emit('LOADING:END');
                }
            };
            reader.onerror = () => {
                alert('讀取檔案失敗');
                this.eventBus.emit('LOADING:END');
            };
            reader.readAsText(file);
        } catch (err) {
            this.eventBus.emit('LOADING:END');
            alert('匯入失敗: ' + err.message);
        }
    }

    async importPPT(file) {
        this.eventBus.emit('LOADING:START', { message: '正在準備轉檔，請稍候...' });
        try {
            let secret = '';
            let provider = 'convertapi';
            try {
                const vaultConfig = ApiVaultManager.getVaultConfig();
                provider = vaultConfig.pptParsing?.provider || 'convertapi';
                if (provider === 'gotenberg') {
                    secret = vaultConfig.pptParsing?.gotenbergBaseUrl || 'http://localhost:3000';
                } else if (provider === 'cloudconvert') {
                    secret = vaultConfig.pptParsing?.cloudconvertSecret || vaultConfig.pptParsing?.secret || '';
                } else {
                    secret = vaultConfig.pptParsing?.secret || '';
                }
            } catch (e) {
                console.warn('Failed to parse vault config', e);
            }

            if (provider === 'convertapi') {
                await this._importPPTWithConvertAPI(file, secret);
            } else if (provider === 'cloudconvert') {
                await this._importPPTWithCloudConvert(file, secret);
            } else if (provider === 'gotenberg') {
                await this._importPPTWithGotenberg(file, secret);
            } else {
                throw new Error("未知的轉檔服務商: " + provider);
            }
        } catch (error) {
            console.error('Error converting PPT:', error);
            alert('簡報轉換失敗: ' + error.message);
        } finally {
            this.eventBus.emit('LOADING:END');
        }
    }

    async _importPPTWithConvertAPI(file, secret) {
        if (!secret) {
            try {
                const legacyVault = JSON.parse(localStorage.getItem('editor_api_vault') || '{}');
                secret = legacyVault.convertApiKey || localStorage.getItem('convertapi_secret') || (import.meta.env && import.meta.env.VITE_CONVERTAPI_SECRET) || '';
            } catch (e) {
                secret = (import.meta.env && import.meta.env.VITE_CONVERTAPI_SECRET) || '';
            }
        }
        if (!secret) throw new Error("未設定 ConvertAPI 金鑰（請至右上角系統金鑰保險箱設定或配置環境變數）");

        this.eventBus.emit('LOADING:START', { message: 'ConvertAPI: 正在上傳並將簡報轉換為 PDF，請稍候...' });
        
        const formData = new FormData();
        formData.append('File', file);
        
        const ext = file.name.split('.').pop().toLowerCase();
        const format = (ext === 'pptx') ? 'pptx' : 'ppt';

        const response = await fetch(`https://v2.convertapi.com/convert/${format}/to/pdf?Secret=${secret}&StoreFile=false`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.Message || `API 回應錯誤 (${response.status})`);
        }

        const data = await response.json();
        
        if (data.Files && data.Files.length > 0 && data.Files[0].FileData) {
            this.eventBus.emit('LOADING:START', { message: '轉換完成，正在匯入畫布...' });
            
            // Decode base64 to Blob
            const base64Data = data.Files[0].FileData;
            const binaryString = window.atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
            const pdfFile = new File([pdfBlob], file.name.replace(/\.pptx?$/i, '.pdf'), { type: 'application/pdf' });
            
            await this.importPDF(pdfFile);
        } else {
            throw new Error("API 未回傳有效的 PDF 資料");
        }
    }

    async _importPPTWithCloudConvert(file, secret) {
        if (!secret) throw new Error("未設定 CloudConvert API Key（請至金鑰保險箱設定）");

        this.eventBus.emit('LOADING:START', { message: 'CloudConvert: 建立轉檔任務中...' });

        // 1. Create Job
        const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + secret,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tasks: {
                    "import-my-file": { "operation": "import/upload" },
                    "convert-my-file": { 
                        "operation": "convert", 
                        "input": "import-my-file", 
                        "output_format": "pdf" 
                    },
                    "export-my-file": { 
                        "operation": "export/url", 
                        "input": "convert-my-file" 
                    }
                }
            })
        });
        const jobData = await jobRes.json();
        if (!jobRes.ok) throw new Error('任務建立失敗: ' + (jobData.message || jobRes.status));

        const uploadTask = jobData.data.tasks.find(t => t.name === 'import-my-file');
        const jobId = jobData.data.id;

        // 2. Upload File
        this.eventBus.emit('LOADING:START', { message: 'CloudConvert: 正在上傳簡報檔案...' });
        const formData = new FormData();
        for (const [key, val] of Object.entries(uploadTask.result.form.parameters)) {
            formData.append(key, val);
        }
        formData.append('file', file);
        
        const uploadRes = await fetch(uploadTask.result.form.url, {
            method: 'POST',
            body: formData
        });
        if (!uploadRes.ok) throw new Error('檔案上傳失敗');

        // 3. Poll Job Status
        this.eventBus.emit('LOADING:START', { message: 'CloudConvert: 雲端轉檔中，請稍候...' });
        let isFinished = false;
        let exportUrl = null;
        while (!isFinished) {
            await new Promise(r => setTimeout(r, 2000)); // poll every 2 seconds
            const statusRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
                headers: { 'Authorization': 'Bearer ' + secret }
            });
            const statusData = await statusRes.json();
            const status = statusData.data.status;
            
            if (status === 'error') throw new Error('雲端轉檔發生錯誤');
            if (status === 'finished') {
                const exportTask = statusData.data.tasks.find(t => t.name === 'export-my-file');
                if (exportTask && exportTask.result && exportTask.result.files && exportTask.result.files[0]) {
                    exportUrl = exportTask.result.files[0].url;
                    isFinished = true;
                } else {
                    throw new Error('無法取得下載連結');
                }
            }
        }

        // 4. Download PDF
        this.eventBus.emit('LOADING:START', { message: 'CloudConvert: 轉換完成，正在下載並匯入畫布...' });
        const pdfRes = await fetch(exportUrl);
        if (!pdfRes.ok) throw new Error('下載 PDF 失敗');
        const pdfBlob = await pdfRes.blob();
        const pdfFile = new File([pdfBlob], file.name.replace(/\.pptx?$/i, '.pdf'), { type: 'application/pdf' });
        
        await this.importPDF(pdfFile);
    }

    async _importPPTWithGotenberg(file, baseUrl) {
        if (!baseUrl) {
            throw new Error('未設定 Gotenberg Base URL，請至保險箱設定。');
        }
        
        this.eventBus.emit('LOADING:START', { message: '正在上傳簡報至本地 Gotenberg...' });
        
        const cleanUrl = baseUrl.replace(/\/$/, '');
        const formData = new FormData();
        formData.append('files', file);

        try {
            const response = await fetch(`${cleanUrl}/forms/libreoffice/convert`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            this.eventBus.emit('LOADING:START', { message: '正在下載 PDF，準備解析...' });
            
            // Gotenberg 回傳的直接是 PDF 檔案流
            const pdfBlob = await response.blob();
            
            // 呼叫原本的 PDF 處理流程
            await this._processPDFData(new Uint8Array(await pdfBlob.arrayBuffer()), file.name.replace(/\.pptx?$/i, '.pdf'));
            
        } catch (error) {
            console.error('[Gotenberg] 轉檔失敗:', error);
            throw new Error('Gotenberg 轉檔失敗: ' + error.message);
        }
    }

    async _processPDFData(pdfData, fileName) {
        try {
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            const pdfDocument = await loadingTask.promise;
            
            const pdfFile = new File([new Blob([pdfData])], fileName, { type: 'application/pdf' });
            await this.importPDF(pdfFile);
        } catch (error) {
            console.error('Error processing PDF data:', error);
            throw error;
        }
    }

    async importImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                
                this.eventBus.emit('LOADING:START', { message: '上傳圖片至雲端...' });
                let finalSrc = dataUrl;
                try {
                    finalSrc = await FirebaseProvider.uploadAsset(file, file.name);
                } catch (err) {
                    console.error('圖片上傳失敗，退回使用本地 Base64:', err);
                }
                this.eventBus.emit('LOADING:END');

                fabric.Image.fromURL(finalSrc, (img) => {
                    // 設定畫布大小與圖片相符
                    this.canvasEngine.resizeArtboard(img.width, img.height);
                    
                    // 將圖片置中並作為底層
                    img.set({
                        left: img.width / 2,
                        top: img.height / 2,
                        originX: 'center',
                        originY: 'center',
                        selectable: false,
                        evented: false,
                        hasControls: false,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        lockRotation: true,
                        layerName: '背景圖片'
                    });
                    
                    // 清空現有物件
                    this.canvasEngine.canvas.getObjects().forEach(obj => {
                        if (obj !== this.canvasEngine.artboard) {
                            this.canvasEngine.canvas.remove(obj);
                        }
                    });

                    this.canvasEngine.canvas.add(img);
                    this.canvasEngine.canvas.sendToBack(img);
                    // 底板 (artboard) 需要在圖片下方
                    this.canvasEngine.canvas.sendToBack(this.canvasEngine.artboard);

                    this.canvasEngine.fitToScreen();
                    
                    this.canvasEngine.saveHistory();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                    this.eventBus.emit('FILE:IMPORTED', { type: 'image' });
                    
                    resolve();
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async importPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;

            const pageStates = {};
            const pageIds = [];
            const thumbnails = {}; // 儲存 pageId -> thumbnail dataUrl
            const pageSizes = {}; // 儲存 pageId -> {width, height}

            // 顯示載入提示
            this.eventBus.emit('LOADING:START', { message: '正在匯入 PDF...' });

            for (let i = 1; i <= numPages; i++) {
                const page = await pdfDocument.getPage(i);
                
                // 1. 產生畫布用高解析背景 (委派給 RetinaRenderer 模組)
                const bgResult = await RetinaRenderer.renderPageBackground(page);
                const highResDataUrl = bgResult.dataUrl;
                const bgWidth = bgResult.width;
                const bgHeight = bgResult.height;
                
                this.eventBus.emit('LOADING:START', { message: `上傳 PDF 第 ${i} 頁至雲端...` });
                const fetchRes = await fetch(highResDataUrl);
                const blob = await fetchRes.blob();
                
                let finalSrc = highResDataUrl;
                try {
                    finalSrc = await FirebaseProvider.uploadAsset(blob, `pdf_page_${i}.jpg`);
                } catch (err) {
                    console.error(`第 ${i} 頁上傳失敗，退回使用本地 Base64:`, err);
                }

                // 2. 產生低解析度縮圖用 (委派給 RetinaRenderer 模組)
                const thumbDataUrl = await RetinaRenderer.renderPageThumbnail(page, 0.5, 0.8);

                const pageId = `page-${Date.now()}-${i}`;
                pageIds.push(pageId);
                thumbnails[pageId] = thumbDataUrl;
                pageSizes[pageId] = { width: bgWidth, height: bgHeight };

                // 建構此頁面的初始狀態 (背景為該頁面影像)
                pageStates[pageId] = [{
                    type: 'image',
                    version: '5.3.0',
                    originX: 'center',
                    originY: 'center',
                    left: bgWidth / 2,
                    top: bgHeight / 2,
                    width: bgWidth,
                    height: bgHeight,
                    scaleX: 1,
                    scaleY: 1,
                    src: finalSrc,
                    crossOrigin: 'anonymous',
                    selectable: false,
                    evented: false,
                    hasControls: false,
                    lockMovementX: true,
                    lockMovementY: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    lockRotation: true,
                    layerName: 'PDF 背景'
                }];
            }

            // 將結果匯入 CanvasEngine 的專案狀態
            this.canvasEngine.pageStates = pageStates;
            this.canvasEngine.pageSizes = pageSizes; // 儲存頁面大小，供 CanvasEngine 參考
            
            // 觸發專案匯入事件，ThumbnailsPanel 會接收並建立頁面列表
            const importedPages = pageIds.map((pid, idx) => ({
                id: pid,
                active: idx === 0,
                thumbnail: thumbnails[pid] || null
            }));

            this.eventBus.emit('PROJECT:IMPORTED', { 
                projectData: { 
                    pageStates: pageStates, 
                    currentPageId: pageIds[0],
                    pages: importedPages
                } 
            });

            // 觸發頁面切換事件
            this.eventBus.emit('PAGE:SWITCH', { newPageId: pageIds[0] });

            // 派送縮圖給 ThumbnailsPanel
            for (let i = 0; i < pageIds.length; i++) {
                const pageId = pageIds[i];
                this.eventBus.emit('CANVAS:THUMBNAIL_UPDATED', { 
                    pageId: pageId, 
                    dataUrl: thumbnails[pageId] 
                });
            }
            this.eventBus.emit('CANVAS:DIRTY', true);
        } catch (error) {
            console.error('Error importing PDF:', error);
            alert('讀取 PDF 失敗');
        } finally {
            this.eventBus.emit('LOADING:END');
        }
    }
}
