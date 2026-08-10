import AIProviderAdapter from '../../../core/AIProviderAdapter.js';

export default class SmartTools {
    constructor(canvasEngine, eventBus) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;
        this.aiAdapter = new AIProviderAdapter(eventBus);
        
        this.bindEvents();
    }

    bindEvents() {
        const btnRmbg = document.getElementById('btn-tool-rmbg');
        if (btnRmbg) {
            btnRmbg.addEventListener('click', () => this.handleRemoveBg(btnRmbg));
        }

        const btnInpaint = document.getElementById('btn-tool-inpaint');
        if (btnInpaint) {
            btnInpaint.addEventListener('click', () => this.handleInpaint(btnInpaint));
        }

        const btnOCR = document.getElementById('btn-tool-ocr');
        if (btnOCR) {
            btnOCR.addEventListener('click', () => this.handleOCR(btnOCR));
        }

        const btnBrushInpaint = document.getElementById('btn-tool-brush-inpaint');
        if (btnBrushInpaint) {
            btnBrushInpaint.addEventListener('click', () => this.handleBrushInpaint(btnBrushInpaint));
        }

        const btnAreaRmbg = document.getElementById('btn-tool-area-rmbg');
        if (btnAreaRmbg) {
            btnAreaRmbg.addEventListener('click', () => this.handleAreaRemoveBg(btnAreaRmbg));
        }

        const btnSolidFill = document.getElementById('btn-tool-solid-fill');
        if (btnSolidFill) {
            btnSolidFill.addEventListener('click', () => this.handleSolidFill(btnSolidFill));
        }
    }

    setButtonLoading(btn, isLoading, defaultText, defaultIconClass) {
        if (isLoading) {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin w-5 text-center text-indigo-500"></i> 處理中...`;
            btn.classList.add('opacity-75', 'pointer-events-none');
        } else {
            btn.innerHTML = `<i class="fas ${defaultIconClass} w-5 text-center text-indigo-500"></i> ${defaultText}`;
            btn.classList.remove('opacity-75', 'pointer-events-none');
        }
    }

    async handleRemoveBg(btn) {
        let activeObject = this.canvasEngine.canvas.getActiveObject();
        
        // 嘗試尋找底圖
        if (!activeObject) {
            const objects = this.canvasEngine.canvas.getObjects();
            activeObject = objects.find(o => o.layerName === '背景圖片' || o.layerName === 'PDF 背景');
        }

        if (!activeObject || (activeObject.type !== 'image' && activeObject.type !== 'rect')) {
            alert('請先選擇一個圖片或形狀物件進行去背 (或先匯入底圖)。');
            return;
        }

        this.setButtonLoading(btn, true);
        
        try {
            const xs = [activeObject.aCoords.tl.x, activeObject.aCoords.tr.x, activeObject.aCoords.bl.x, activeObject.aCoords.br.x];
            const ys = [activeObject.aCoords.tl.y, activeObject.aCoords.tr.y, activeObject.aCoords.bl.y, activeObject.aCoords.br.y];
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const w = maxX - minX;
            const h = maxY - minY;
            
            // 備份並重置 viewportTransform 以確保 toDataURL 擷取座標正確
            const vpt = this.canvasEngine.canvas.viewportTransform.slice();
            this.canvasEngine.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            
            const dataUrl = this.canvasEngine.canvas.toDataURL({ 
                format: 'png',
                left: minX,
                top: minY,
                width: w,
                height: h,
                multiplier: 1
            });
            
            this.canvasEngine.canvas.setViewportTransform(vpt);

            const res = await fetch(dataUrl);
            const imageBlob = await res.blob();
            
            const resultUrl = await this.aiAdapter.removeBackground(imageBlob);
            
            fabric.Image.fromURL(resultUrl, (img) => {
                img.set({
                    left: minX,
                    top: minY,
                    originX: 'left',
                    originY: 'top',
                    scaleX: w / img.width, 
                    scaleY: h / img.height,
                    transparentCorners: false,
                    cornerColor: '#334155',
                    cornerStrokeColor: '#ffffff',
                    borderColor: '#334155',
                    cornerSize: 10,
                    padding: 5,
                    lockUniScaling: activeObject.lockUniScaling,
                    selectable: activeObject.selectable,
                    evented: activeObject.evented,
                    hasControls: activeObject.hasControls,
                    lockMovementX: activeObject.lockMovementX,
                    lockMovementY: activeObject.lockMovementY,
                    lockScalingX: activeObject.lockScalingX,
                    lockScalingY: activeObject.lockScalingY,
                    lockRotation: activeObject.lockRotation,
                    layerName: activeObject.layerName,
                    angle: 0
                });
                img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
                this.canvasEngine.canvas.remove(activeObject);
                this.canvasEngine.addObject(img);
                
                // 如果是底圖，需要推到最底層
                if (!img.selectable) {
                    this.canvasEngine.canvas.sendToBack(img);
                    if (this.canvasEngine.artboard) {
                        this.canvasEngine.canvas.sendToBack(this.canvasEngine.artboard);
                    }
                    this.canvasEngine.canvas.discardActiveObject();
                }
                
                this.setButtonLoading(btn, false, '一鍵去背', 'fa-magic');
            });
        } catch (e) {
            alert('去背失敗: ' + e.message);
            this.setButtonLoading(btn, false, '一鍵去背', 'fa-magic');
        }
    }

    async handleInpaint(btn) {
        const maskObject = this.canvasEngine.canvas.getActiveObject();
        if (!maskObject) {
            alert('請先選擇要修補的區域物件 (作為遮擋物)。');
            return;
        }

        this.setButtonLoading(btn, true);
        
        try {
            const canvas = this.canvasEngine.canvas;
            
            // 計算物件的絕對座標
            const xs = [maskObject.aCoords.tl.x, maskObject.aCoords.tr.x, maskObject.aCoords.bl.x, maskObject.aCoords.br.x];
            const ys = [maskObject.aCoords.tl.y, maskObject.aCoords.tr.y, maskObject.aCoords.bl.y, maskObject.aCoords.br.y];
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            
            // 備份 viewportTransform 並重置
            const vpt = canvas.viewportTransform.slice();
            canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            
            // 隱藏所有「非底圖」的物件，以便擷取到底下最乾淨的真實背景
            const allObjects = canvas.getObjects();
            const visibilityBackup = allObjects.map(o => {
                const vis = o.visible;
                if (o.layerName !== '背景圖片' && o.layerName !== 'PDF 背景') {
                    o.set('visible', false);
                }
                return { obj: o, visible: vis };
            });
            
            // 確保沒有任何物件處於選取狀態 (避免 upperCanvas 的選取框殘留)
            canvas.discardActiveObject();
            canvas.renderAll();
            
            // 匯出純淨的底圖畫布 (不含任何選取框與上層物件)
            const cleanCanvasEl = canvas.toCanvasElement(1); 
            const cleanCtx = cleanCanvasEl.getContext('2d', { willReadFrequently: true });
            
            // 恢復所有物件的可見性與選取狀態
            visibilityBackup.forEach(({ obj, visible }) => {
                obj.set('visible', visible);
            });
            canvas.setActiveObject(maskObject);
            canvas.renderAll();
            
            // 在形狀周圍取樣幾個點的顏色 (上下左右及四角，稍微往外推 5px)
            const offset = 5;
            const w = maxX - minX;
            const h = maxY - minY;
            const samplePoints = [
                { x: minX + w / 2, y: minY - offset }, // 上
                { x: minX + w / 2, y: maxY + offset }, // 下
                { x: minX - offset, y: minY + h / 2 }, // 左
                { x: maxX + offset, y: minY + h / 2 }, // 右
                { x: minX - offset, y: minY - offset }, // 左上
                { x: maxX + offset, y: minY - offset }, // 右上
                { x: minX - offset, y: maxY + offset }, // 左下
                { x: maxX + offset, y: maxY + offset }  // 右下
            ];
            
            let rTotal = 0, gTotal = 0, bTotal = 0, validSamples = 0;
            
            for (const pt of samplePoints) {
                const pxX = Math.floor(pt.x);
                const pxY = Math.floor(pt.y);
                if (pxX >= 0 && pxX < cleanCanvasEl.width && pxY >= 0 && pxY < cleanCanvasEl.height) {
                    const pixel = cleanCtx.getImageData(pxX, pxY, 1, 1).data;
                    // 忽略全透明的像素 (或是特別紅的像素，防呆排除選框紅色)
                    if (pixel[3] > 0 && !(pixel[0] > 200 && pixel[1] < 50 && pixel[2] < 50)) {
                        rTotal += pixel[0];
                        gTotal += pixel[1];
                        bTotal += pixel[2];
                        validSamples++;
                    }
                }
            }
            
            let targetColor = '#ffffff'; // 預設白色
            if (validSamples > 0) {
                const r = Math.round(rTotal / validSamples);
                const g = Math.round(gTotal / validSamples);
                const b = Math.round(bTotal / validSamples);
                const toHex = (c) => {
                    const hex = c.toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                };
                targetColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            }

            // 移除原本的選取框，建立一個全新的乾淨矩形來遮擋
            const coverRect = new fabric.Rect({
                left: maskObject.left,
                top: maskObject.top,
                width: maskObject.width,
                height: maskObject.height,
                scaleX: maskObject.scaleX,
                scaleY: maskObject.scaleY,
                angle: maskObject.angle,
                originX: maskObject.originX,
                originY: maskObject.originY,
                fill: targetColor,
                strokeWidth: 0,
                selectable: true,
                hasControls: true
            });
            
            canvas.remove(maskObject);
            this.canvasEngine.addObject(coverRect);
            
            // 恢復 viewportTransform
            canvas.setViewportTransform(vpt);
            canvas.renderAll();
            
            this.setButtonLoading(btn, false, '智慧修補', 'fa-band-aid');
        } catch (e) {
            alert('修補失敗: ' + (e.message || String(e)));
            this.setButtonLoading(btn, false, '智慧修補', 'fa-band-aid');
        }
    }

    async handleOCR(btn) {
        const activeObject = this.canvasEngine.canvas.getActiveObject();
        if (!activeObject) {
            alert('請先選擇要辨識的選取框或物件。');
            return;
        }

        this.setButtonLoading(btn, true);
        
        try {
            // 取得物件絕對座標
            const xs = [activeObject.aCoords.tl.x, activeObject.aCoords.tr.x, activeObject.aCoords.bl.x, activeObject.aCoords.br.x];
            const ys = [activeObject.aCoords.tl.y, activeObject.aCoords.tr.y, activeObject.aCoords.bl.y, activeObject.aCoords.br.y];
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const w = maxX - minX;
            const h = maxY - minY;
            
            // 檢查選取範圍是否過大 (大於 10 萬平方像素)
            if (w * h > 500000) {
                if (!window.confirm("圈選的文字內容過多，有可能會發生辨識失敗的情形，確定要執行嗎？")) {
                    this.setButtonLoading(btn, false, '辨識 (OCR)', 'fa-font');
                    return;
                }
            }

            // 1. 取得背景顏色 (遮擋用)
            const allObjects = this.canvasEngine.canvas.getObjects();
            const visibilityBackup = allObjects.map(o => {
                const vis = o.visible;
                if (o.layerName !== '背景圖片' && o.layerName !== 'PDF 背景') {
                    o.set('visible', false);
                }
                return { obj: o, visible: vis };
            });
            this.canvasEngine.canvas.discardActiveObject();
            
            // 重要：在 toCanvasElement 之前，必須重置 viewportTransform，否則截取的畫面與座標對不上
            const vpt = this.canvasEngine.canvas.viewportTransform.slice();
            this.canvasEngine.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            this.canvasEngine.canvas.renderAll();
            
            const cleanCanvasEl = this.canvasEngine.canvas.toCanvasElement(1); 
            const cleanCtx = cleanCanvasEl.getContext('2d', { willReadFrequently: true });
            
            visibilityBackup.forEach(({ obj, visible }) => {
                obj.set('visible', visible);
            });
            
            // 恢復 viewport 供後續顯示
            this.canvasEngine.canvas.setViewportTransform(vpt);

            const offset = 5;
            const samplePoints = [
                { x: minX + w / 2, y: minY - offset },
                { x: minX + w / 2, y: maxY + offset },
                { x: minX - offset, y: minY + h / 2 },
                { x: maxX + offset, y: minY + h / 2 },
                { x: minX - offset, y: minY - offset },
                { x: maxX + offset, y: minY - offset },
                { x: minX - offset, y: maxY + offset },
                { x: maxX + offset, y: maxY + offset }
            ];
            
            let rTotal = 0, gTotal = 0, bTotal = 0, validSamples = 0;
            for (const pt of samplePoints) {
                const pxX = Math.floor(pt.x);
                const pxY = Math.floor(pt.y);
                if (pxX >= 0 && pxX < cleanCanvasEl.width && pxY >= 0 && pxY < cleanCanvasEl.height) {
                    const pixel = cleanCtx.getImageData(pxX, pxY, 1, 1).data;
                    if (pixel[3] > 0 && !(pixel[0] > 200 && pixel[1] < 50 && pixel[2] < 50)) {
                        rTotal += pixel[0];
                        gTotal += pixel[1];
                        bTotal += pixel[2];
                        validSamples++;
                    }
                }
            }
            
            let targetColor = '#ffffff'; // 預設白色
            if (validSamples > 0) {
                const r = Math.round(rTotal / validSamples);
                const g = Math.round(gTotal / validSamples);
                const b = Math.round(bTotal / validSamples);
                const toHex = (c) => {
                    const hex = c.toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                };
                targetColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            }

            // 2. 擷取選框影像以進行 OCR
            const wasVisible = activeObject.visible;
            activeObject.set('visible', false);
            this.canvasEngine.canvas.discardActiveObject();
            
            this.canvasEngine.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            this.canvasEngine.canvas.renderAll();

            const dataUrl = this.canvasEngine.canvas.toDataURL({ 
                format: 'jpeg',
                left: minX,
                top: minY,
                width: w,
                height: h,
                multiplier: 2 // 放大一點有助於 OCR 辨識
            });
            
            // 恢復畫布狀態
            this.canvasEngine.canvas.setViewportTransform(vpt);
            activeObject.set('visible', wasVisible);
            this.canvasEngine.canvas.setActiveObject(activeObject);
            this.canvasEngine.canvas.renderAll();

            // 3. 呼叫 AIProviderAdapter 進行 OCR
            let textContent = '';
            
            try {
                textContent = await this.aiAdapter.ocr(dataUrl);
            } catch (err) {
                console.error('[SmartTools] 智慧 OCR 辨識失敗:', err);
                alert(`辨識失敗: ${err.message}`);
                this.setButtonLoading(btn, false, '智慧辨識 (OCR)', 'fa-font');
                return;
            }

            if (!textContent) {
                alert('沒有辨識到文字或辨識失敗。');
                this.setButtonLoading(btn, false, '智慧辨識 (OCR)', 'fa-font');
                return;
            }

            // 4. 生成覆蓋用矩形與可編輯文字
            const lines = textContent.split('\n');
            const maxLineLength = Math.max(...lines.map(l => l.length), 1);
            const lineCount = lines.length;
            
            // 計算字體大小: 找出符合寬度與高度的最大可能字級
            const fontSizeByWidth = w / maxLineLength;
            const fontSizeByHeight = h / (lineCount * 1.16); // fabric 預設行高約 1.16
            const estimatedFontSize = Math.max(12, Math.floor(Math.min(fontSizeByWidth, fontSizeByHeight)));

            const coverRect = new fabric.Rect({
                left: minX,
                top: minY,
                width: w,
                height: h,
                fill: targetColor,
                strokeWidth: 0,
                selectable: true,
                hasControls: true
            });

            const text = new fabric.Textbox(textContent, {
                left: minX,
                top: minY,
                width: w,
                fontSize: estimatedFontSize,
                fontFamily: 'Noto Sans TC',
                fill: '#000000',
                splitByGrapheme: true,
                originX: 'left',
                originY: 'top',
                transparentCorners: false,
                cornerColor: '#334155',
                cornerStrokeColor: '#ffffff',
                borderColor: '#334155',
                cornerSize: 10,
                padding: 0
            });

            // 如果是選取框，辨識完就移除原選取框
            if (activeObject.isRegionBox) {
                this.canvasEngine.canvas.remove(activeObject);
            }
            
            // 依序加入畫布: 先背景後文字
            this.canvasEngine.addObject(coverRect);
            this.canvasEngine.addObject(text);
            
            this.canvasEngine.canvas.setActiveObject(text);
            this.setButtonLoading(btn, false, '智慧辨識 (OCR)', 'fa-font');
        } catch (e) {
            console.error('OCR 失敗:', e);
            alert('辨識失敗: ' + e.message);
            this.setButtonLoading(btn, false, '智慧辨識 (OCR)', 'fa-font');
        }
    }

    async handleBrushInpaint(btn) {
        let activeObject = this.canvasEngine.canvas.getActiveObject();
        
        // 嘗試尋找底圖
        if (!activeObject) {
            const objects = this.canvasEngine.canvas.getObjects();
            activeObject = objects.find(o => o.layerName === '背景圖片' || o.layerName === 'PDF 背景');
        }

        if (!activeObject) {
            alert('請先選擇要修補的圖片物件 (或先匯入底圖)。');
            return;
        }
        this.inpaintTarget = activeObject;

        const brushSettings = document.getElementById('inpaint-brush-settings');
        const brushSlider = document.getElementById('inpaint-brush-size');
        const brushVal = document.getElementById('inpaint-brush-size-val');

        if (!this.canvasEngine.canvas.isDrawingMode) {
            // 開啟畫筆模式
            this.canvasEngine.canvas.isDrawingMode = true;
            this.canvasEngine.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvasEngine.canvas);
            this.canvasEngine.canvas.freeDrawingBrush.color = 'rgba(239, 68, 68, 0.5)'; // 紅色半透明遮罩
            
            // 初始化畫筆大小
            const initSize = parseInt(brushSlider?.value || '30', 10);
            this.canvasEngine.canvas.freeDrawingBrush.width = initSize;
            
            // 顯示設定面板
            if (brushSettings) {
                brushSettings.classList.remove('hidden');
                
                // 綁定動態調整大小
                this.brushSizeHandler = (e) => {
                    const size = parseInt(e.target.value, 10);
                    if (this.canvasEngine.canvas.freeDrawingBrush) {
                        this.canvasEngine.canvas.freeDrawingBrush.width = size;
                    }
                    if (brushVal) brushVal.textContent = size + 'px';
                };
                brushSlider.addEventListener('input', this.brushSizeHandler);
            }
            
            btn.innerHTML = `<i class="fas fa-check w-5 text-center text-rose-500"></i> 完成塗抹`;
            btn.classList.add('bg-rose-50', 'text-rose-700');
            
            // 監聽畫筆結束
            this.brushPathCreatedHandler = async (e) => {
                const path = e.path;
                // 關閉畫筆模式
                this.canvasEngine.canvas.isDrawingMode = false;
                this.canvasEngine.canvas.off('path:created', this.brushPathCreatedHandler);
                if (brushSettings && this.brushSizeHandler) {
                    brushSlider.removeEventListener('input', this.brushSizeHandler);
                    brushSettings.classList.add('hidden');
                }
                
                this.setButtonLoading(btn, true);
                try {
                    const target = this.inpaintTarget;
                    const xs = [target.aCoords.tl.x, target.aCoords.tr.x, target.aCoords.bl.x, target.aCoords.br.x];
                    const ys = [target.aCoords.tl.y, target.aCoords.tr.y, target.aCoords.bl.y, target.aCoords.br.y];
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    const w = maxX - minX;
                    const h = maxY - minY;

                    const canvas = this.canvasEngine.canvas;
                    const objects = canvas.getObjects();
                    
                    // 備份 viewportTransform 並重置
                    const vpt = canvas.viewportTransform.slice();
                    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                    
                    // 1. 備份所有物件可見性與背景
                    const originalStates = objects.map(o => ({ obj: o, visible: o.visible }));
                    const originalBg = canvas.backgroundColor;

                    // 2. 匯出原圖 (只顯示 target)
                    objects.forEach(o => o.set('visible', false));
                    target.set('visible', true);
                    canvas.renderAll();
                    
                    const imageDataUrl = canvas.toDataURL({
                        format: 'png',
                        left: minX,
                        top: minY,
                        width: w,
                        height: h,
                        multiplier: 1
                    });

                    // 3. 匯出遮罩 (只顯示 path，背景黑，筆刷白)
                    objects.forEach(o => o.set('visible', false));
                    canvas.backgroundColor = '#000000';
                    path.set({ visible: true, stroke: '#ffffff', fill: '' });
                    canvas.renderAll();
                    
                    const maskDataUrl = canvas.toDataURL({
                        format: 'png',
                        left: minX,
                        top: minY,
                        width: w,
                        height: h,
                        multiplier: 1
                    });

                    // 4. 恢復原狀與 viewportTransform
                    originalStates.forEach((state) => state.obj.set('visible', state.visible));
                    canvas.backgroundColor = originalBg;
                    canvas.remove(path); // 移除紅色畫筆
                    canvas.setViewportTransform(vpt);
                    canvas.renderAll();

                    // 5. 呼叫 API
                    const imageBlob = await fetch(imageDataUrl).then(r => r.blob());
                    const maskBlob = await fetch(maskDataUrl).then(r => r.blob());

                    const resultUrl = await this.aiAdapter.inpaint(imageBlob, maskBlob);

                    // 6. 替換原圖
                    fabric.Image.fromURL(resultUrl, (img) => {
                        img.set({
                            left: minX,
                            top: minY,
                            originX: 'left',
                            originY: 'top',
                            scaleX: w / img.width,
                            scaleY: h / img.height,
                            transparentCorners: false,
                            cornerColor: '#334155',
                            cornerStrokeColor: '#ffffff',
                            borderColor: '#334155',
                            cornerSize: 10,
                            padding: 5,
                            lockUniScaling: target.lockUniScaling,
                            selectable: target.selectable,
                            evented: target.evented,
                            hasControls: target.hasControls,
                            lockMovementX: target.lockMovementX,
                            lockMovementY: target.lockMovementY,
                            lockScalingX: target.lockScalingX,
                            lockScalingY: target.lockScalingY,
                            lockRotation: target.lockRotation,
                            layerName: target.layerName,
                            angle: 0
                        });
                        img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
                        canvas.remove(target);
                        this.canvasEngine.addObject(img);
                        
                        // 如果是底圖，需要推到最底層
                        if (!img.selectable) {
                            canvas.sendToBack(img);
                            if (this.canvasEngine.artboard) {
                                canvas.sendToBack(this.canvasEngine.artboard);
                            }
                            canvas.discardActiveObject();
                        }
                        
                        this.setButtonLoading(btn, false, '塗抹修補 (畫筆)', 'fa-eraser');
                    });
                } catch (err) {
                    alert('修補失敗: ' + err.message);
                    this.setButtonLoading(btn, false, '塗抹修補 (畫筆)', 'fa-eraser');
                }
            };
            this.canvasEngine.canvas.on('path:created', this.brushPathCreatedHandler);
        } else {
            // 手動取消
            this.canvasEngine.canvas.isDrawingMode = false;
            if (this.brushPathCreatedHandler) {
                this.canvasEngine.canvas.off('path:created', this.brushPathCreatedHandler);
            }
            if (brushSettings && this.brushSizeHandler) {
                brushSlider.removeEventListener('input', this.brushSizeHandler);
                brushSettings.classList.add('hidden');
            }
            btn.innerHTML = `<i class="fas fa-eraser w-5 text-center text-indigo-500"></i> 塗抹修補 (畫筆)`;
            btn.classList.remove('bg-rose-50', 'text-rose-700');
        }
    }

    async handleAreaRemoveBg(btn) {
        const regionBoxes = this.canvasEngine.canvas.getObjects().filter(o => o.isRegionBox);
        if (regionBoxes.length === 0) {
            alert('請先在畫布上拖曳拉出紅色虛線選取框！');
            return;
        }
        
        const box = regionBoxes[0];
        
        try {
            // 動態載入 imgly 避免一開始就載入大檔案
            const { removeBackground } = await import('@imgly/background-removal');
            
            // 計算絕對座標
            const xs = [box.aCoords.tl.x, box.aCoords.tr.x, box.aCoords.bl.x, box.aCoords.br.x];
            const ys = [box.aCoords.tl.y, box.aCoords.tr.y, box.aCoords.bl.y, box.aCoords.br.y];
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const w = maxX - minX;
            const h = maxY - minY;

            // 隱藏選取框避免被拍進去
            box.set('visible', false);
            this.canvasEngine.canvas.discardActiveObject();
            
            // 備份並重置 viewportTransform
            const vpt = this.canvasEngine.canvas.viewportTransform.slice();
            this.canvasEngine.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            this.canvasEngine.canvas.renderAll();

            const dataUrl = this.canvasEngine.canvas.toDataURL({ 
                format: 'png',
                left: minX,
                top: minY,
                width: w,
                height: h,
                multiplier: 1
            });
            
            this.canvasEngine.canvas.setViewportTransform(vpt);

            const res = await fetch(dataUrl);
            const imageBlob = await res.blob();
            
            // 開始處理，鎖定按鈕與選取框
            btn.innerHTML = `<i class="fas fa-spinner fa-spin w-5 text-center text-indigo-500"></i> AI 處理中...`;
            btn.classList.add('opacity-75', 'pointer-events-none');
            
            const originalSelectable = box.selectable;
            const originalEvented = box.evented;
            box.set({ selectable: false, evented: false, hasControls: false, visible: true });
            this.canvasEngine.canvas.requestRenderAll();
            
            // 使用 @imgly 本機 AI 進行去背 (設定 publicPath 從 CDN 下載模型)
            const resultBlob = await removeBackground(imageBlob, {
                publicPath: 'https://unpkg.com/@imgly/background-removal-data@1.4.5/dist/',
                progress: (key, current, total) => {
                    const pct = Math.round((current / total) * 100);
                    btn.innerHTML = `<i class="fas fa-spinner fa-spin w-5 text-center text-indigo-500"></i> 模型 ${pct}%`;
                }
            });
            
            const resultUrl = URL.createObjectURL(resultBlob);
            
            fabric.Image.fromURL(resultUrl, (img) => {
                img.set({
                    left: minX,
                    top: minY,
                    originX: 'left',
                    originY: 'top',
                    scaleX: w / img.width,
                    scaleY: h / img.height,
                    transparentCorners: false,
                    cornerColor: '#334155',
                    cornerStrokeColor: '#ffffff',
                    borderColor: '#334155',
                    cornerSize: 10,
                    padding: 5,
                    lockUniScaling: true,
                    angle: 0
                });
                img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
                this.canvasEngine.canvas.remove(box); // 移除原本的紅色選取框
                this.canvasEngine.addObject(img);
            });
        } catch(e) {
            console.error(e);
            alert('去背失敗: ' + (e.message || String(e)));
            box.set('visible', true);
            if (this.canvasEngine.canvas.getObjects().includes(box)) {
                box.set({ selectable: true, evented: true, hasControls: true });
            }
            this.canvasEngine.canvas.renderAll();
        } finally {
            this.setButtonLoading(btn, false, '選框去背', 'fa-cut');
        }
    }

    async handleSolidFill(btn) {
        if (this.solidFillActive) {
            this.stopSolidFill(btn);
            return;
        }

        // 當切換到其他工具時自動關閉純色覆蓋
        if (!this.solidFillToolChangedHandler) {
            this.solidFillToolChangedHandler = () => {
                if (this.solidFillActive) {
                    this.stopSolidFill(btn);
                }
            };
            this.eventBus.on('UI:TOOL_CHANGED', this.solidFillToolChangedHandler);
        }

        await this.startColorPicker(btn);
    }

    async startColorPicker(btn) {
        this.solidFillActive = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin w-5 text-center text-indigo-500"></i> 取色中...`;
        btn.classList.remove('bg-white', 'text-slate-700');
        btn.classList.add('bg-indigo-50', 'text-indigo-700');
        
        try {
            let color = '#ffffff';
            if (window.EyeDropper) {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                color = result.sRGBHex;
            } else {
                color = prompt("您的瀏覽器不支援原生取色器，請手動輸入色碼 (例如: #ff0000):", "#ff0000");
                if (!color) {
                    this.stopSolidFill(btn);
                    return;
                }
            }
            
            this.startDrawingMode(btn, color);
            
        } catch (e) {
            // User cancelled EyeDropper
            this.stopSolidFill(btn);
        }
    }

    startDrawingMode(btn, color) {
        const canvas = this.canvasEngine.canvas;
        const settingsPanel = document.getElementById('solid-fill-settings');
        const brushSlider = document.getElementById('solid-fill-brush-size');
        const brushVal = document.getElementById('solid-fill-brush-size-val');

        canvas.isDrawingMode = true;
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        canvas.freeDrawingBrush.color = color;
        
        const initSize = parseInt(brushSlider?.value || '30', 10);
        canvas.freeDrawingBrush.width = initSize;
        
        if (settingsPanel) {
            settingsPanel.classList.remove('hidden');
            
            if (!this.solidFillBrushSizeHandler) {
                this.solidFillBrushSizeHandler = (e) => {
                    const size = parseInt(e.target.value, 10);
                    if (this.canvasEngine.canvas.freeDrawingBrush) {
                        this.canvasEngine.canvas.freeDrawingBrush.width = size;
                    }
                    if (brushVal) brushVal.textContent = size + 'px';
                };
            }
            brushSlider.addEventListener('input', this.solidFillBrushSizeHandler);
            
            if (!this.solidFillRepickHandler) {
                this.solidFillRepickHandler = () => {
                    this.canvasEngine.canvas.isDrawingMode = false;
                    this.startColorPicker(btn);
                };
            }
            const btnRepick = document.getElementById('btn-solid-fill-repick');
            if (btnRepick) {
                btnRepick.removeEventListener('click', this.solidFillRepickHandler); // 防重複綁定
                btnRepick.addEventListener('click', this.solidFillRepickHandler);
            }
        }
        
        btn.innerHTML = `<i class="fas fa-check w-5 text-center text-rose-500"></i> 完成純色覆蓋`;
        btn.classList.remove('bg-indigo-50', 'text-indigo-700', 'bg-white', 'text-slate-700'); // 移除其他樣式
        btn.classList.add('bg-rose-50', 'text-rose-700');
    }

    stopSolidFill(btn) {
        this.solidFillActive = false;
        this.canvasEngine.canvas.isDrawingMode = false;
        
        const settingsPanel = document.getElementById('solid-fill-settings');
        const brushSlider = document.getElementById('solid-fill-brush-size');
        const btnRepick = document.getElementById('btn-solid-fill-repick');
        
        if (settingsPanel) {
            settingsPanel.classList.add('hidden');
        }
        if (brushSlider && this.solidFillBrushSizeHandler) {
            brushSlider.removeEventListener('input', this.solidFillBrushSizeHandler);
        }
        if (btnRepick && this.solidFillRepickHandler) {
            btnRepick.removeEventListener('click', this.solidFillRepickHandler);
        }
        if (this.solidFillToolChangedHandler) {
            this.eventBus.off('UI:TOOL_CHANGED', this.solidFillToolChangedHandler);
            this.solidFillToolChangedHandler = null;
        }
        
        btn.innerHTML = `<i class="fas fa-square w-5 text-center text-indigo-500"></i> 純色覆蓋`;
        btn.classList.remove('bg-rose-50', 'text-rose-700', 'bg-indigo-50', 'text-indigo-700');
        btn.classList.add('bg-white', 'text-slate-700');
    }
}
