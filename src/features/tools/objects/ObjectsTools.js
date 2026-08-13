import { buildTableGroup, extractTableData } from './tableBuilder';
import FirebaseProvider from '../../collaboration/FirebaseProvider.js';

export default class ObjectsTools {
    constructor(canvasEngine, eventBus) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;
        
        this.tableResizingCtx = null;

        this.bindEvents();
    }

    bindEvents() {
        this.eventBus.on('CANVAS:UPDATE_TABLE_PROP', (data) => {
            if (data.target && data.config) {
                this.updateTable(data.target, data.config);
            }
        });
        const btnText = document.getElementById('btn-tool-text');
        if (btnText) {
            btnText.addEventListener('click', () => {
                this.addText();
                this.eventBus.emit('APP:STATUS_UPDATE', { text: '已新增文字，您可以直接在畫布上編輯' });
            });
        }

        const btnQR = document.getElementById('btn-tool-qrcode');
        if (btnQR) {
            btnQR.addEventListener('click', () => {
                this.showQRModal();
            });
        }
        
        // 綁定 QR Modal 事件
        const modal = document.getElementById('modal-qrcode');
        const btnClose = document.getElementById('btn-qr-close');
        const btnCancel = document.getElementById('btn-qr-cancel');
        const btnConfirm = document.getElementById('btn-qr-confirm');
        
        if (modal) {
            const hideModal = () => {
                modal.classList.add('hidden');
                document.getElementById('input-qr-url').value = '';
            };
            
            if (btnClose) btnClose.addEventListener('click', hideModal);
            if (btnCancel) btnCancel.addEventListener('click', hideModal);
            if (btnConfirm) btnConfirm.addEventListener('click', () => {
                const url = document.getElementById('input-qr-url').value.trim();
                if (url) {
                    this.addRealQRCode(url);
                    hideModal();
                } else {
                    alert('請輸入有效的網址或文字');
                }
            });
        }

        const btnTable = document.getElementById('btn-tool-table');
        if (btnTable) {
            btnTable.addEventListener('click', () => {
                this.addTable();
            });
        }

        const btnExtImg = document.getElementById('btn-tool-ext-img');
        const inputExtImg = document.getElementById('input-tool-ext-img');
        if (btnExtImg && inputExtImg) {
            btnExtImg.addEventListener('click', () => inputExtImg.click());
            inputExtImg.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.eventBus.emit('LOADING:START', { message: '上傳圖片至雲端...' });
                    try {
                        const downloadUrl = await FirebaseProvider.uploadAsset(file, file.name);
                        this.addExternalImage(downloadUrl);
                    } catch (err) {
                        console.error('圖片上傳失敗，退回使用本地 Base64:', err);
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            this.addExternalImage(event.target.result);
                        };
                        reader.readAsDataURL(file);
                    }
                    this.eventBus.emit('LOADING:END');
                }
                e.target.value = ''; // 清空
            });
        }
        
        // 表格互動事件 (雙擊編輯與邊界拖拉)
        this.canvasEngine.canvas.on('mouse:dblclick', this.handleTableDoubleClick.bind(this));
        this.canvasEngine.canvas.on('mouse:down', this.handleTableMouseDown.bind(this));
        this.canvasEngine.canvas.on('mouse:move', this.handleTableMouseMove.bind(this));
        this.canvasEngine.canvas.on('mouse:up', this.handleTableMouseUp.bind(this));
        
        // 處理表格整體的縮放 (維持文字大小，只改變行列尺寸)
        this.canvasEngine.canvas.on('object:scaling', this.handleTableScaling.bind(this));
        this.canvasEngine.canvas.on('object:modified', this.handleTableModified.bind(this));
    }

    handleTableDoubleClick(opt) {
        const tableGroup = opt.target;
        if (!tableGroup || !tableGroup.isTable) return;
        
        const subTarget = opt.subTargets && opt.subTargets[0];
        if (subTarget && subTarget.isCell) {
            this.showTableCellEditor(tableGroup, subTarget);
        }
    }

    showTableCellEditor(tableGroup, cell) {
        const canvas = this.canvasEngine.canvas;

        // 計算在畫布上的絕對位置，因為 cell 的座標是相對於 tableGroup
        const matrix = tableGroup.calcTransformMatrix();
        const cellPoint = new fabric.Point(cell.left, cell.top);
        const absPos = fabric.util.transformPoint(cellPoint, matrix);

        const editingText = new fabric.Textbox(cell.text || '', {
            left: absPos.x,
            top: absPos.y,
            width: cell.width * tableGroup.scaleX,
            fontSize: cell.fontSize * tableGroup.scaleY,
            fontFamily: cell.fontFamily,
            fill: cell.fill,
            textAlign: cell.textAlign,
            splitByGrapheme: false,
            originX: cell.originX,
            originY: cell.originY,
            hasControls: false,
            hasBorders: false,
            backgroundColor: 'transparent',
            padding: 0
        });

        // 隱藏原本表格內的字
        cell.set('opacity', 0);
        canvas.requestRenderAll();

        canvas.add(editingText);
        canvas.setActiveObject(editingText);
        editingText.enterEditing();
        editingText.selectAll();

        editingText.on('editing:exited', () => {
            const newText = editingText.text;
            canvas.remove(editingText);
            
            // If the tableGroup is no longer on the canvas (e.g. replaced or cleared), abort
            if (!this.canvasEngine.canvas.getObjects().includes(tableGroup)) return;
            
            // 存入設定並重建
            const data = extractTableData(tableGroup);
            if (!data[cell.rowIndex]) data[cell.rowIndex] = [];
            if (!data[cell.rowIndex][cell.colIndex]) data[cell.rowIndex][cell.colIndex] = {};
            data[cell.rowIndex][cell.colIndex].text = newText;
            
            const newConfig = { ...tableGroup.tableConfig, data };
            this.updateTable(tableGroup, newConfig, data);
            this.canvasEngine.saveHistory();
        });
    }

    handleTableMouseDown(opt) {
        if (!opt.target || !opt.target.isTable || !opt.subTargets) return;
        const resizer = opt.subTargets[0];
        if (!resizer || (!resizer.isColResizer && !resizer.isRowResizer)) return;

        const tableGroup = opt.target;
        tableGroup.lockMovementX = true;
        tableGroup.lockMovementY = true;

        const isCol = resizer.isColResizer;
        
        // 建立預覽參考線 (Guide Line)
        const matrix = tableGroup.calcTransformMatrix();
        const resizerPt = new fabric.Point(resizer.left + resizer.width / 2, resizer.top + resizer.height / 2);
        const absPos = fabric.util.transformPoint(resizerPt, matrix);
        const tl = fabric.util.transformPoint(new fabric.Point(0, 0), matrix);
        const br = fabric.util.transformPoint(new fabric.Point(tableGroup.width, tableGroup.height), matrix);
        
        const guideLine = new fabric.Line(
            isCol ? [absPos.x, tl.y, absPos.x, br.y] : [tl.x, absPos.y, br.x, absPos.y],
            {
                stroke: '#3b82f6',
                strokeWidth: 2,
                strokeDashArray: [5, 5],
                selectable: false,
                evented: false
            }
        );
        this.canvasEngine.canvas.add(guideLine);

        this.tableResizingCtx = {
            tableGroup,
            resizer,
            isCol,
            index: resizer.resizerIndex,
            startX: opt.e.clientX,
            startY: opt.e.clientY,
            originalWidths: [...tableGroup.colWidths],
            originalHeights: [...tableGroup.rowHeights],
            guideLine,
            initialAbsPos: absPos,
            minDelta: isCol ? -tableGroup.colWidths[resizer.resizerIndex - 1] + 30 : -tableGroup.rowHeights[resizer.resizerIndex - 1] + 20
        };
    }

    handleTableMouseMove(opt) {
        if (!this.tableResizingCtx) return;
        
        const ctx = this.tableResizingCtx;
        const zoom = this.canvasEngine.canvas.getZoom();
        
        let dx = (opt.e.clientX - ctx.startX) / zoom;
        let dy = (opt.e.clientY - ctx.startY) / zoom;
        
        if (ctx.isCol) {
            dx = dx / ctx.tableGroup.scaleX;
            dx = Math.max(ctx.minDelta, dx);
            ctx.delta = dx;
            
            const newAbsXLogical = ctx.initialAbsPos.x + (dx * ctx.tableGroup.scaleX);
            ctx.guideLine.set({ x1: newAbsXLogical, x2: newAbsXLogical });
        } else {
            dy = dy / ctx.tableGroup.scaleY;
            dy = Math.max(ctx.minDelta, dy);
            ctx.delta = dy;
            
            const newAbsYLogical = ctx.initialAbsPos.y + (dy * ctx.tableGroup.scaleY);
            ctx.guideLine.set({ y1: newAbsYLogical, y2: newAbsYLogical });
        }

        this.canvasEngine.canvas.requestRenderAll();
    }

    handleTableMouseUp() {
        if (this.tableResizingCtx) {
            const ctx = this.tableResizingCtx;
            const tableGroup = ctx.tableGroup;
            
            // Abort if tableGroup is no longer on canvas
            if (!this.canvasEngine.canvas.getObjects().includes(tableGroup)) {
                this.tableResizingCtx = null;
                if (this.guideLine) {
                    this.canvasEngine.canvas.remove(this.guideLine);
                    this.guideLine = null;
                }
                return;
            }
            
            tableGroup.lockMovementX = false;
            tableGroup.lockMovementY = false;
            
            if (ctx.delta) {
                if (!tableGroup.tableConfig) tableGroup.tableConfig = {};
                
                if (ctx.isCol) {
                    const newWidths = [...ctx.originalWidths];
                    const colIdx = ctx.index - 1;
                    newWidths[colIdx] = newWidths[colIdx] + ctx.delta;
                    tableGroup.colWidths = newWidths;
                    tableGroup.tableConfig.colWidths = newWidths;
                } else {
                    const newHeights = [...ctx.originalHeights];
                    const rowIdx = ctx.index - 1;
                    newHeights[rowIdx] = newHeights[rowIdx] + ctx.delta;
                    tableGroup.rowHeights = newHeights;
                    tableGroup.tableConfig.rowHeights = newHeights;
                }
                
                this.rebuildTable(tableGroup);
            }
            
            this.canvasEngine.canvas.remove(ctx.guideLine);
            this.tableResizingCtx = null;
            this.canvasEngine.saveHistory();
        }
    }

    rebuildTable(tableGroup) {
        const extractedData = extractTableData(tableGroup);
        const left = tableGroup.left;
        const top = tableGroup.top;
        const config = tableGroup.tableConfig;
        
        const options = {
            rows: tableGroup.tableRows,
            cols: tableGroup.tableCols,
            colWidths: tableGroup.colWidths,
            rowHeights: tableGroup.rowHeights,
            data: extractedData,
            
            tableBorderWidth: parseInt(config.strokeWidth) || 1.5,
            tableBorderColor: config.strokeColor || '#cbd5e1',
            tableFontFamily: config.fontEn && config.fontEn !== '(跟隨中文)' ? `"${config.fontEn}", "${config.fontZh || 'Noto Sans TC'}", sans-serif` : (config.fontZh || 'Noto Sans TC'),
            tableTextAlign: (config.align || 'top-left').split('-')[1] || 'left',
            tableVerticalAlign: (config.align || 'top-left').split('-')[0] || 'top',
            tableFontSize: parseInt(config.fontSize) || 16,
            tableTextColor: config.fontColor || '#334155',
            headerTextColor: config.headerFontColor || '#ffffff',
            
            borderTop: config.borders ? config.borders.top : true,
            borderBottom: config.borders ? config.borders.bottom : true,
            borderLeft: config.borders ? config.borders.left : true,
            borderRight: config.borders ? config.borders.right : true,
            borderInnerH: config.borders ? config.borders.innerH : true,
            borderInnerV: config.borders ? config.borders.innerV : true,
            
            hasHeader: config.template === 'header',
            tableTemplate: config.template === 'stripe' ? 'striped' : 'default',
            isHanddrawn: config.isHanddrawn === true,
            tableStripeColor: config.stripeColor || '#f8fafc',
            headerBgColor: config.headerBgColor || '#f1f5f9'
        };

        const newGroup = buildTableGroup(options);
        newGroup.set({
            left, top,
            angle: tableGroup.angle || 0,
            opacity: tableGroup.opacity !== undefined ? tableGroup.opacity : 1,
            flipX: tableGroup.flipX || false,
            flipY: tableGroup.flipY || false,
            scaleX: tableGroup.scaleX,
            scaleY: tableGroup.scaleY
        });
        newGroup.tableConfig = config;

        newGroup.setCoords();
        this.canvasEngine.canvas.remove(tableGroup);
        this.canvasEngine.canvas.add(newGroup);
        this.canvasEngine.canvas.setActiveObject(newGroup);
        
        // Ensure the rebuilt table (which might have grown due to grid line dragging or text auto-expand) doesn't exceed canvas
        this.canvasEngine.enforceBoundingBox(newGroup);
        
        this.canvasEngine.canvas.requestRenderAll();
        
        // 更新 ctx ref 如果還在拖曳
        if (this.tableResizingCtx) {
            this.tableResizingCtx.tableGroup = newGroup;
        }
    }

    handleTableScaling(opt) {
        const target = opt.target;
        if (!target || !target.isTable) return;
        
        // 拖拉角落放大縮小時，為了不讓文字變形放大，我們把裡面的 textbox 進行反向縮放
        const sx = target.scaleX;
        const sy = target.scaleY;
        target.getObjects('textbox').forEach(tb => {
            tb.set({
                scaleX: 1 / sx,
                scaleY: 1 / sy
            });
        });
    }

    handleTableModified(opt) {
        const target = opt.target;
        if (target && target.isTable && (target.scaleX !== 1 || target.scaleY !== 1)) {
            if (!target.tableConfig) target.tableConfig = {};
            
            // 將整體的縮放倍率套用到 colWidths 與 rowHeights 上
            target.colWidths = target.colWidths.map(w => w * target.scaleX);
            target.rowHeights = target.rowHeights.map(h => h * target.scaleY);
            
            // 同步寫入 tableConfig 避免被 updateTable 蓋掉
            target.tableConfig.colWidths = target.colWidths;
            target.tableConfig.rowHeights = target.rowHeights;
            
            // 重置物件內部文字的縮放，確保重建表格前資料乾淨
            target.getObjects('textbox').forEach(tb => {
                tb.set({ scaleX: 1, scaleY: 1 });
            });
            target.set({ scaleX: 1, scaleY: 1 });
            
            target.scaleX = 1;
            target.scaleY = 1;
            
            // 延遲重建表格，避免在 Fabric 核心的 modified 事件中同步移除目標導致狀態卡死（沒辦法放開表格）
            setTimeout(() => {
                this.rebuildTable(target);
                this.canvasEngine.saveHistory();
            }, 10);
        }
    }

    showQRModal() {
        const modal = document.getElementById('modal-qrcode');
        if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('input-qr-url');
            if (input) input.focus();
        }
    }

    addText(content = '請輸入文字', left = null, top = null) {
        const canvas = this.canvasEngine.canvas;
        const artboard = this.canvasEngine.artboard;
        
        const x = left !== null ? left : artboard.left + artboard.width / 2;
        const y = top !== null ? top : artboard.top + artboard.height / 2;

        const text = new fabric.Textbox(content, {
            left: x,
            top: y,
            width: 300, // 預設寬度
            splitByGrapheme: true, // 中文自動換行與對齊
            fontFamily: 'Noto Sans TC',
            fontSize: 48,
            fill: '#334155',
            originX: 'center',
            originY: 'center',
            transparentCorners: false,
            cornerColor: '#334155',
            cornerStrokeColor: '#ffffff',
            borderColor: '#334155',
            cornerSize: 10,
            padding: 5
        });

        // 隱藏上下控制點，避免被垂直拉伸導致文字變形
        text.setControlsVisibility({ mt: false, mb: false });

        this.canvasEngine.addObject(text);
        text.enterEditing();
        text.selectAll();
    }

    addRealQRCode(dataText) {
        const artboard = this.canvasEngine.artboard;
        
        // 初始化預設樣式
        const defaultOptions = {
            width: 256,
            height: 256,
            data: dataText,
            dotsOptions: {
                color: "#000000",
                type: "square" // 預設方塊
            },
            backgroundOptions: {
                color: "#ffffff",
            },
            cornersSquareOptions: {
                type: "square" // 預設方塊
            }
        };

        const qrCode = new QRCodeStyling(defaultOptions);

        qrCode.getRawData("png").then((blob) => {
            const qrUrl = URL.createObjectURL(blob);
            fabric.Image.fromURL(qrUrl, (img) => {
                img.set({
                    left: artboard.left + artboard.width / 2,
                    top: artboard.top + artboard.height / 2,
                    originX: 'center',
                    originY: 'center',
                    scaleX: 150 / img.width,
                    scaleY: 150 / img.height,
                    transparentCorners: false,
                    cornerColor: '#334155',
                    cornerStrokeColor: '#ffffff',
                    borderColor: '#334155',
                    cornerSize: 10,
                    padding: 5
                });
                
                // 標記並儲存樣式，供屬性面板使用
                img.isQRCode = true;
                img.qrOptions = defaultOptions;

                this.canvasEngine.addObject(img);
            });
        });
    }

    addTable(rows = 3, cols = 3) {
        const options = {
            rows, cols, cellW: 100, cellH: 40,
            tableBorderWidth: 1.5, tableBorderColor: '#cbd5e1',
            tableFontFamily: 'Noto Sans TC',
            tableTextAlign: 'center', tableVerticalAlign: 'middle',
            borderTop: true, borderBottom: true, borderLeft: true, borderRight: true,
            borderInnerH: true, borderInnerV: true,
            tableFontSize: 16, tableTextColor: '#334155', headerTextColor: '#ffffff', headerBgColor: '#f1f5f9', stripeColor: '#f8fafc', tableTemplate: 'default',
            hasHeader: false, isHanddrawn: false
        };
        const group = buildTableGroup(options);
        
        group.tableConfig = {
            ...options,
            align: options.tableVerticalAlign + '-' + options.tableTextAlign,
            borders: {
                top: options.borderTop, bottom: options.borderBottom,
                left: options.borderLeft, right: options.borderRight,
                innerH: options.borderInnerH, innerV: options.borderInnerV
            }
        };
        
        const artboard = this.canvasEngine.artboard;
        group.set({
            left: artboard.left + artboard.width / 2 - (group.width || 0) / 2,
            top: artboard.top + artboard.height / 2 - (group.height || 0) / 2
        });

        this.canvasEngine.addObject(group);
        this.canvasEngine.canvas.setActiveObject(group);
    }

    updateTable(tableGroup, newConfig, overriddenData = null) {
        // 從舊表格提取文字與屬性
        const extractedData = overriddenData || extractTableData(tableGroup);
        
        const left = tableGroup.left;
        const top = tableGroup.top;

        // map newConfig to table options
        const borders = newConfig.borders || { top: true, bottom: true, left: true, right: true, innerH: true, innerV: true };
        const alignParts = (newConfig.align || 'top-left').split('-');
        const valign = alignParts[0] || 'top';
        const halign = alignParts[1] || 'left';

        const newRows = newConfig.rows || tableGroup.tableRows;
        const newCols = newConfig.cols || tableGroup.tableCols;
        
        let newColWidths = [...(tableGroup.colWidths || [])];
        if (newColWidths.length < newCols) {
            newColWidths = newColWidths.concat(Array(newCols - newColWidths.length).fill(newConfig.cellWidth || 150));
        } else if (newColWidths.length > newCols) {
            newColWidths = newColWidths.slice(0, newCols);
        }
        
        let newRowHeights = [...(tableGroup.rowHeights || [])];
        if (newRowHeights.length < newRows) {
            newRowHeights = newRowHeights.concat(Array(newRows - newRowHeights.length).fill(newConfig.cellHeight || 50));
        } else if (newRowHeights.length > newRows) {
            newRowHeights = newRowHeights.slice(0, newRows);
        }

        const options = {
            rows: newRows,
            cols: newCols,
            colWidths: newColWidths,
            rowHeights: newRowHeights,
            data: extractedData,
            
            tableBorderWidth: parseInt(newConfig.strokeWidth) || 1.5,
            tableBorderColor: newConfig.strokeColor || '#cbd5e1',
            tableFontFamily: newConfig.fontEn && newConfig.fontEn !== '(跟隨中文)' ? `"${newConfig.fontEn}", "${newConfig.fontZh || 'Noto Sans TC'}", sans-serif` : (newConfig.fontZh || 'Noto Sans TC'),
            tableTextAlign: halign,
            tableVerticalAlign: valign,
            tableFontSize: parseInt(newConfig.fontSize) || 16,
            tableTextColor: newConfig.fontColor || '#334155',
            headerTextColor: newConfig.headerFontColor || '#ffffff',
            
            borderTop: borders.top,
            borderBottom: borders.bottom,
            borderLeft: borders.left,
            borderRight: borders.right,
            borderInnerH: borders.innerH,
            borderInnerV: borders.innerV,
            
            hasHeader: newConfig.template === 'header',
            tableTemplate: newConfig.template === 'stripe' ? 'striped' : 'default',
            isHanddrawn: newConfig.isHanddrawn === true,
            tableStripeColor: newConfig.stripeColor || '#f8fafc',
            headerBgColor: newConfig.headerBgColor || '#f1f5f9'
        };

        const newGroup = buildTableGroup(options);
        
        newGroup.set({
            left, top,
            angle: tableGroup.angle || 0,
            opacity: tableGroup.opacity !== undefined ? tableGroup.opacity : 1,
            flipX: tableGroup.flipX || false,
            flipY: tableGroup.flipY || false,
            scaleX: tableGroup.scaleX,
            scaleY: tableGroup.scaleY
        });
        // 轉移原本綁定給屬性面板的狀態
        newGroup.tableConfig = newConfig;

        newGroup.setCoords();
        this.canvasEngine.canvas.remove(tableGroup);
        this.canvasEngine.canvas.add(newGroup);
        this.canvasEngine.canvas.setActiveObject(newGroup);
        this.canvasEngine.canvas.requestRenderAll();
        this.eventBus.emit('CANVAS:DIRTY', true);
    }

    addExternalImage(dataUrl) {
        fabric.Image.fromURL(dataUrl, (img) => {
            const artboard = this.canvasEngine.artboard;
            const maxSize = Math.min(artboard.width, artboard.height) * 0.8;
            
            if (img.width > maxSize || img.height > maxSize) {
                const scale = Math.min(maxSize / img.width, maxSize / img.height);
                img.scale(scale);
            }
            
            img.set({
                left: artboard.left + artboard.width / 2,
                top: artboard.top + artboard.height / 2,
                originX: 'center',
                originY: 'center',
                transparentCorners: false,
                cornerColor: '#334155',
                cornerStrokeColor: '#ffffff',
                borderColor: '#334155',
                cornerSize: 10,
                padding: 5,
                lockUniScaling: true // 預設鎖定比例縮放
            });
            img.setControlsVisibility({
                mt: false, mb: false, ml: false, mr: false
            });
            this.canvasEngine.addObject(img);
        });
    }
}
