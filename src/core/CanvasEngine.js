import { fabric } from 'fabric';
import SmartGuides from '../features/canvas_auxiliary/SmartGuides.js';

// 修正 Fabric.js 無法針對無空白字元的中文字進行「分散對齊 (justify)」的問題，並支援單行強制平均分配
if (fabric.Textbox) {
    fabric.Textbox.prototype.enlargeSpaces = function() {
        var diffSpace, currentLineWidth, numberOfSpaces, accumulatedSpace, line, charBound, spaces;
        for (var i = 0, len = this._textLines.length; i < len; i++) {
            if (this.textAlign !== 'justify' && (i === len - 1 || this.isEndOfWrapping(i))) {
                continue;
            }
            accumulatedSpace = 0;
            line = this._textLines[i];
            currentLineWidth = this.getLineWidth(i);
            
            if (currentLineWidth < this.width) {
                spaces = this.textLines[i].match(this._reSpacesAndTabs);
                if (spaces) {
                    numberOfSpaces = spaces.length;
                    diffSpace = (this.width - currentLineWidth) / numberOfSpaces;
                    for (var j = 0, jlen = line.length; j <= jlen; j++) {
                        charBound = this.__charBounds[i][j];
                        if (this._reSpaceAndTab.test(line[j])) {
                            charBound.width += diffSpace;
                            charBound.kernedWidth += diffSpace;
                            charBound.left += accumulatedSpace;
                            accumulatedSpace += diffSpace;
                        } else {
                            charBound.left += accumulatedSpace;
                        }
                    }
                } else {
                    // CJK 修正：若沒有空白字元，則平均分配給所有字元（除最後一個）
                    numberOfSpaces = line.length - 1;
                    if (numberOfSpaces > 0) {
                        diffSpace = (this.width - currentLineWidth) / numberOfSpaces;
                        for (var j = 0, jlen = line.length; j <= jlen; j++) {
                            charBound = this.__charBounds[i][j];
                            charBound.left += accumulatedSpace;
                            if (j < jlen - 1) {
                                charBound.width += diffSpace;
                                charBound.kernedWidth += diffSpace;
                                accumulatedSpace += diffSpace;
                            }
                        }
                    }
                }
            }
        }
    };

    fabric.Text.prototype._renderChars = function(method, ctx, line, left, top, lineIndex) {
      // set proper line offset
      var lineHeight = this.getHeightOfLine(lineIndex),
          isJustify = this.textAlign.indexOf('justify') !== -1,
          actualStyle,
          nextStyle,
          charsToRender = '',
          charBox,
          boxWidth = 0,
          timeToRender,
          path = this.path,
          shortCut = !isJustify && this.charSpacing === 0 && this.isEmptyStyles(lineIndex) && !path,
          isLtr = this.direction === 'ltr', sign = this.direction === 'ltr' ? 1 : -1,
          drawingLeft, currentDirection = ctx.canvas.getAttribute('dir');
      ctx.save();
      if (currentDirection !== this.direction) {
        ctx.canvas.setAttribute('dir', isLtr ? 'ltr' : 'rtl');
        ctx.direction = isLtr ? 'ltr' : 'rtl';
        ctx.textAlign = isLtr ? 'left' : 'right';
      }
      top -= lineHeight * this._fontSizeFraction / this.lineHeight;
      if (shortCut) {
        // render all the line in one pass without checking
        this._renderChar(method, ctx, lineIndex, 0, line.join(''), left, top, lineHeight);
        ctx.restore();
        return;
      }
      for (var i = 0, len = line.length - 1; i <= len; i++) {
        timeToRender = i === len || this.charSpacing || path;
        charsToRender += line[i];
        charBox = this.__charBounds[lineIndex][i];
        if (boxWidth === 0) {
          left += sign * (charBox.kernedWidth - charBox.width);
          boxWidth += charBox.width;
        }
        else {
          boxWidth += charBox.kernedWidth;
        }
        if (isJustify && !timeToRender) {
          if (this._reSpaceAndTab.test(line[i])) {
            timeToRender = true;
          } else {
            // CJK 修正：在 Justify 模式下，強制每個字元單獨渲染以套用擴展後的 kernedWidth
            timeToRender = true;
          }
        }
        if (!timeToRender) {
          // if we have charSpacing, we render char by char
          actualStyle = actualStyle || this.getCompleteStyleDeclaration(lineIndex, i);
          nextStyle = this.getCompleteStyleDeclaration(lineIndex, i + 1);
          timeToRender = fabric.util.hasStyleChanged(actualStyle, nextStyle, false);
        }
        if (timeToRender) {
          if (path) {
            ctx.save();
            ctx.translate(charBox.renderLeft, charBox.renderTop);
            ctx.rotate(charBox.angle);
            this._renderChar(method, ctx, lineIndex, i, charsToRender, -boxWidth / 2, 0, lineHeight);
            ctx.restore();
          }
          else {
            drawingLeft = left;
            this._renderChar(method, ctx, lineIndex, i, charsToRender, drawingLeft, top, lineHeight);
          }
          charsToRender = '';
          actualStyle = nextStyle;
          left += sign * boxWidth;
          boxWidth = 0;
        }
      }
      ctx.restore();
    };
}

// 修正 Fabric.js 在特定損毀的 text styles 下 toObject() 會崩潰的問題 (TypeError: Cannot read properties of undefined)
if (fabric.util && fabric.util.stylesToArray) {
    const originalStylesToArray = fabric.util.stylesToArray;
    fabric.util.stylesToArray = function(styles, text) {
        try {
            return originalStylesToArray(styles, text);
        } catch (e) {
            console.warn('[Fabric Patch] stylesToArray failed for malformed styles, skipping styles:', e);
            return [];
        }
    };
}

/**
 * 畫布核心引擎
 * 封裝 Fabric.js，負責管理畫布大小、物件群組與撞牆碰撞邏輯
 */
export default class CanvasEngine {
    constructor(canvasId, options = {}, eventBus = null) {
        this.canvasId = canvasId;
        this.eventBus = eventBus;
        this.container = document.getElementById('workspace-container');
        
        this.canvas = new fabric.Canvas(canvasId, {
            width: this.container.clientWidth,
            height: this.container.clientHeight,
            selection: false, // 預設關閉，切換至選取工具時才開啟
            selectionColor: 'rgba(255,0,0,0.05)',
            selectionBorderColor: 'red',
            selectionDashArray: [5, 5],
            selectionLineWidth: 2,
            preserveObjectStacking: true,
            fireRightClick: true,
            fireMiddleClick: true,
            stopContextMenu: true
        });

        this.artboard = null;
        this.initArtboard(options.width || 800, options.height || 450);

        this.pageStates = {}; // 記憶各頁面的物件狀態
        this.currentPageId = 'page-1'; // 預設第一頁
        
        // 歷史紀錄 (Undo/Redo)
        this.historyStack = [];
        this.redoStack = [];
        this.isHistoryProcessing = false;

        // 綁定所有核心事件
        this.bindEvents();
        this.applyCustomStyles();

        // 智慧參考線與吸附引擎
        this.smartGuides = new SmartGuides(this);

        // 監聽容器大小改變 (解決側邊欄開關或分割視窗導致畫布被裁切的問題)
        let resizeDebounceTimer = null;
        const handleViewportResize = () => {
            if (this.canvas && this.container && this.artboard) {
                const w = this.container.clientWidth || window.innerWidth;
                const h = this.container.clientHeight || window.innerHeight;
                if (w > 0 && h > 0) {
                    this.canvas.setWidth(w);
                    this.canvas.setHeight(h);
                    this.fitToScreen();
                }
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(handleViewportResize, 60);
        });
        resizeObserver.observe(this.container);

        // 視窗縮放時自動調整畫布大小並自適應縮放
        window.addEventListener('resize', () => {
            clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(handleViewportResize, 60);
        });
    }

    initArtboard(width, height) {
        // 建立白色工作區 (Artboard)
        this.artboard = new fabric.Rect({
            id: 'artboard',
            isArtboard: true,
            left: 0,
            top: 0,
            width: width,
            height: height,
            fill: '#ffffff',
            selectable: false,
            evented: false,
            hoverCursor: 'default',
            shadow: new fabric.Shadow({
                color: 'rgba(51, 65, 85, 0.2)',
                blur: 15,
                offsetX: 5,
                offsetY: 5
            })
        });

        // 設定 Artboard 邊角 (僅保留圓角，移除外框)
        this.artboard.set({
            rx: 0, // 改回直角比較像標準畫布
            ry: 0
        });

        this.canvas.add(this.artboard);
        this.centerArtboard();
    }

    centerArtboard() {
        const vpt = this.canvas.viewportTransform;
        vpt[4] = (this.canvas.width - this.artboard.width) / 2;
        vpt[5] = (this.canvas.height - this.artboard.height) / 2;
        this.canvas.setViewportTransform(vpt);
        
        // 同步背景網格
        if(this.container) {
            this.container.style.backgroundPosition = `${vpt[4]}px ${vpt[5]}px`;
            // 當前縮放比例如果改變，也可以在這裡調整 backgroundSize
        }
    }

    resizeArtboard(width, height) {
        if (!this.artboard) return;
        this.artboard.set({ width, height });
        this.centerArtboard();
        
        // Ensure objects stay within bounds after resize
        this.canvas.getObjects().forEach(obj => {
            if (obj !== this.artboard) {
                this.enforceBoundingBox(obj);
            }
        });
        
        this.canvas.requestRenderAll();
    }

    fitToScreen() {
        if (!this.artboard || !this.canvas) return;
        
        // 畫布容器大小 (若 canvas 尚未更新尺寸，優先取 container 寬高)
        const containerWidth = (this.container && this.container.clientWidth > 0) 
            ? this.container.clientWidth 
            : (this.canvas.width || window.innerWidth);
        const containerHeight = (this.container && this.container.clientHeight > 0) 
            ? this.container.clientHeight 
            : (this.canvas.height || window.innerHeight);
        
        // 底板大小
        const artboardWidth = this.artboard.width || 1280;
        const artboardHeight = this.artboard.height || 720;
        
        // 彈性邊距：在小螢幕時縮小邊距以爭取最大可視範圍
        const padding = containerWidth < 600 ? 12 : 32;
        const availableWidth = Math.max(containerWidth - padding * 2, 50);
        const availableHeight = Math.max(containerHeight - padding * 2, 50);
        
        // 計算寬高縮放比，取最小值以確保完整顯示且絕不為負數或0
        const scaleX = availableWidth / artboardWidth;
        const scaleY = availableHeight / artboardHeight;
        let scale = Math.min(scaleX, scaleY);
        
        // 限制安全縮放範圍 (0.05 ~ 1.0)
        scale = Math.max(0.05, Math.min(scale, 1.0));

        // 設定畫布整體縮放
        this.canvas.setZoom(scale);
        
        // 重新置中
        const vpt = this.canvas.viewportTransform;
        vpt[4] = Math.max(0, (containerWidth - artboardWidth * scale) / 2);
        vpt[5] = Math.max(0, (containerHeight - artboardHeight * scale) / 2);
        this.canvas.setViewportTransform(vpt);
        this.canvas.calcOffset();
        this.canvas.requestRenderAll();
        
        // 同步背景網格
        if (this.container) {
            this.container.style.backgroundPosition = `${vpt[4]}px ${vpt[5]}px`;
        }

        // 觸發視圖更新事件
        if (this.eventBus) {
            this.eventBus.emit('CANVAS:VIEWPORT_CHANGED', { scale, vpt });
        }
    }

    /**
     * 綁定全局畫布事件
     */
    bindEvents() {
        this.canvas.on('object:moving', (e) => {
            this.enforceBoundingBox(e.target);
        });
        this.canvas.on('object:scaling', (e) => {
            this.enforceBoundingBox(e.target);
        });

        // 綁定平移與選取框的滑鼠事件
        this.canvas.on('mouse:down', this.onMouseDown.bind(this));
        this.canvas.on('mouse:move', this.onMouseMove.bind(this));
        this.canvas.on('mouse:up', this.onMouseUp.bind(this));
        
        // 綁定滑鼠滾輪縮放
        this.canvas.on('mouse:wheel', this.onMouseWheel.bind(this));

        // 監聽文字編輯事件，確保自動存檔與歷史紀錄
        this.canvas.on('text:changed', () => {
            if (this.eventBus) {
                this.eventBus.emit('CANVAS:DIRTY', true);
            }
        });
        
        this.canvas.on('text:editing:exited', () => {
            this.saveHistory();
            if (this.eventBus) {
                this.eventBus.emit('CANVAS:DIRTY', true);
                this.updateThumbnail();
            }
        });

        // 監聽畫布異動，廣播髒標記與縮圖
        this.canvas.on('object:added', (e) => {
            // 排除背景版
            if (e.target !== this.artboard) {
                this.saveHistory();
                if (this.eventBus) {
                    this.eventBus.emit('CANVAS:DIRTY', true);
                    this.updateThumbnail();
                }
            }
        });
        this.canvas.on('object:modified', () => {
            this.saveHistory();
            if (this.eventBus) {
                this.eventBus.emit('CANVAS:DIRTY', true);
                this.updateThumbnail();
            }
        });
        this.canvas.on('object:removed', (e) => {
            // 如果是在復原過程中移除的，不觸發歷史儲存
            if (this.isHistoryProcessing) return;
            // 如果移除的不是 artboard
            if (e.target !== this.artboard) {
                this.saveHistory();
                if (this.eventBus) {
                    this.eventBus.emit('CANVAS:DIRTY', true);
                    this.updateThumbnail();
                }
            }
        });

        // 監聽選取事件，廣播給 PropertiesPanel
        this.canvas.on('selection:created', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:updated', (e) => this.onObjectSelected(e));
        this.canvas.on('selection:cleared', () => {
            if (this.eventBus) {
                this.eventBus.emit('CANVAS:OBJECT_CLEARED');
            }
        });

        // 監聽工作區切換，執行畫布清除 (但保留工作板)
        if (this.eventBus) {
            this.eventBus.on('WORKSPACE:MODE_CHANGED', () => {
                this.canvas.discardActiveObject();
                this.canvas.discardActiveObject();
                const objects = [...this.canvas.getObjects()];
                objects.forEach(obj => {
                    if (obj !== this.artboard && !obj.isSmartGuide) {
                        this.canvas.remove(obj);
                    }
                });
                this.pageStates = {}; // 清空所有頁面暫存
                this.currentPageId = 'page-1';
                this.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY', false); // 清除後狀態歸零
            });

            // 監聽頁面切換 (存取快取)
            this.eventBus.on('PAGE:SWITCH', ({ newPageId }) => {
                this.savePageState();
                this.loadPageState(newPageId);
            });

            this.eventBus.on('CANVAS:HISTORY_PAUSE', () => {
                this.isHistoryProcessing = true;
            });

            this.eventBus.on('CANVAS:HISTORY_RESUME', () => {
                this.isHistoryProcessing = false;
            });

            this.eventBus.on('PAGE:DELETE', ({ pageId }) => {
                delete this.pageStates[pageId];
            });

            this.eventBus.on('PAGE:COPY', ({ sourceId, newId }) => {
                // 如果正在複製當下這頁，先確保最新畫面有寫入快取
                if (sourceId === this.currentPageId) {
                    this.savePageState();
                }
                
                // 將來源頁面的快取資料深拷貝給新頁面，並重新生成物件 ID 以免衝突
                if (this.pageStates[sourceId]) {
                    const copiedData = JSON.parse(JSON.stringify(this.pageStates[sourceId]));
                    copiedData.forEach(obj => {
                        if (obj.id && obj.id !== 'artboard') {
                            obj.id = 'obj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
                        }
                    });
                    this.pageStates[newId] = copiedData;
                }
            });
        }
    }

    savePageState() {
        if (!this.currentPageId) return;
        // 過濾掉底板與標記為 excludeFromExport 的物件 (如裁切框)
        const objects = this.canvas.getObjects().filter(obj => obj !== this.artboard && !obj.excludeFromExport);
        // 儲存當前頁面的完整狀態 (包含所有物件與自訂屬性)
        this.pageStates[this.currentPageId] = objects.map(obj => {
            try {
                return obj.toObject(['layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
            } catch (e) {
                console.error("[CanvasEngine] toObject failed in savePageState, skipping:", e);
                return null;
            }
        }).filter(Boolean);
    }

    loadPageState(pageId, forceLoad = false) {
        if (!forceLoad && this.currentPageId === pageId) return;
        
        // 切換前，先儲存當前頁面的狀態 (只有當真的要離開當前頁面時才儲存，避免覆寫新專案的預設模板)
        if (this.currentPageId && this.canvas && this.currentPageId !== pageId) {
            this.savePageState();
        }
        
        this.currentPageId = pageId;
        
        if (this.eventBus) {
            this.eventBus.emit('CANVAS:PAGE_LOADING_START');
        }

        // 暫停歷史記錄與縮圖更新，避免大量物件被移除時觸發 O(N^2) 的效能災難
        this.isHistoryProcessing = true;

        // 清空畫布(除了底板與智慧輔助線)
        this.canvas.discardActiveObject();
        const objects = [...this.canvas.getObjects()];
        objects.forEach(obj => {
            if (obj !== this.artboard && !obj.isSmartGuide) {
                this.canvas.remove(obj);
            }
        });

        // 如果有記錄該頁面的特定大小，自動調整底板
        if (this.pageSizes && this.pageSizes[pageId]) {
            this.resizeArtboard(this.pageSizes[pageId].width, this.pageSizes[pageId].height);
        }
        
        // 確保每次切換頁面或載入專案時，都能自動適應螢幕大小，避免 PDF 被放大
        this.fitToScreen();

        // 如果有暫存資料，就將其還原到畫布上
        const savedData = this.pageStates[pageId];
        if (savedData && savedData.length > 0) {
            fabric.util.enlivenObjects(savedData, (objs) => {
                objs.forEach(obj => {
                    if (document.body.classList.contains('viewer-mode')) {
                        obj.set({
                            selectable: false,
                            evented: false,
                            editable: false,
                            lockMovementX: true,
                            lockMovementY: true,
                            lockScalingX: true,
                            lockScalingY: true,
                            lockRotation: true
                        });
                    }
                    this.canvas.add(obj);
                });
                this.canvas.requestRenderAll();
                this.updateThumbnail(); // 載入後也更新一次縮圖
                this.isHistoryProcessing = false;
                
                // 切換頁面後清空歷史
                this.historyStack = [];
                this.redoStack = [];
                this.saveHistory();
                
                if (this.eventBus) {
                    this.eventBus.emit('CANVAS:PAGE_LOADING_END');
                }
            });
        } else {
            this.canvas.requestRenderAll();
            this.updateThumbnail();
            this.isHistoryProcessing = false;
            
            this.historyStack = [];
            this.redoStack = [];
            this.saveHistory();
            
            if (this.eventBus) {
                this.eventBus.emit('CANVAS:PAGE_LOADING_END');
            }
        }
    }

    saveHistory() {
        if (this.isHistoryProcessing) return;
        
        // 儲存狀態，包含復原所需的自訂屬性
        const objects = this.canvas.getObjects().filter(obj => obj !== this.artboard && !obj.excludeFromExport);
        const state = objects.map(obj => {
            try {
                return obj.toObject(['layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
            } catch (e) {
                console.error("[CanvasEngine] toObject failed for object, skipping to prevent crash:", e);
                return null;
            }
        }).filter(Boolean);
        
        // 避免重複連續儲存相同狀態
        if (this.historyStack.length > 0) {
            const lastState = this.historyStack[this.historyStack.length - 1];
            if (JSON.stringify(lastState) === JSON.stringify(state)) {
                return;
            }
        }

        this.historyStack.push(state);
        // 限制最多 50 步歷史
        if (this.historyStack.length > 50) this.historyStack.shift();
        
        // 只要有新動作就清空 redo
        this.redoStack = [];
    }

    undo() {
        if (this.historyStack.length <= 1) return; // 堆疊只剩初始狀態或空時不能 undo
        
        this.isHistoryProcessing = true;
        const currentState = this.historyStack.pop();
        this.redoStack.push(currentState);
        
        const previousState = this.historyStack[this.historyStack.length - 1];
        this.loadState(previousState);
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        this.isHistoryProcessing = true;
        const nextState = this.redoStack.pop();
        this.historyStack.push(nextState);
        
        this.loadState(nextState);
    }

    loadState(state) {
        // 清空畫布 (保留底板)
        const objects = this.canvas.getObjects();
        objects.forEach(obj => {
            if (obj !== this.artboard) {
                this.canvas.remove(obj);
            }
        });

        if (state && state.length > 0) {
            fabric.util.enlivenObjects(state, (objs) => {
                objs.forEach(obj => {
                    this.canvas.add(obj);
                });
                this.canvas.requestRenderAll();
                this.isHistoryProcessing = false;
                
                if (this.eventBus) {
                    this.eventBus.emit('CANVAS:DIRTY', true);
                    this.updateThumbnail();
                }
            });
        } else {
            this.canvas.requestRenderAll();
            this.isHistoryProcessing = false;
            if (this.eventBus) {
                this.eventBus.emit('CANVAS:DIRTY', true);
                this.updateThumbnail();
            }
        }
    }

    updateThumbnail() {
        if (!this.eventBus || !this.artboard) return;
        
        const dataUrl = this.getArtboardThumbnailDataURL(0.1);
        if (dataUrl) {
            this.eventBus.emit('CANVAS:THUMBNAIL_UPDATED', { 
                pageId: this.currentPageId, 
                dataUrl: dataUrl 
            });
        }
    }

    /**
     * 擷取底板範圍之乾淨居中縮圖 (供 Dashboard 封面與縮圖面板使用)
     */
    getArtboardThumbnailDataURL(multiplier = 0.25) {
        if (!this.artboard) return null;
        const originalVpt = this.canvas.viewportTransform ? this.canvas.viewportTransform.slice() : [1, 0, 0, 1, 0, 0];
        this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        this.canvas.renderAll();

        let dataUrl = null;
        try {
            dataUrl = this.canvas.toDataURL({
                left: this.artboard.left,
                top: this.artboard.top,
                width: this.artboard.width,
                height: this.artboard.height,
                multiplier: multiplier,
                format: 'png'
            });
        } catch (error) {
            console.warn('無法產生縮圖 (可能是 CORS 跨域限制導致 canvas 被污染):', error);
            // Fallback: 如果無法擷取 canvas，嘗試直接使用當前頁面的背景圖
            if (this.pageStates && this.pageStates[this.currentPageId]) {
                const bgImg = this.pageStates[this.currentPageId].find(o => o.type === 'image' && o.src);
                if (bgImg && bgImg.src) {
                    dataUrl = bgImg.src;
                }
            }
        } finally {
            this.canvas.setViewportTransform(originalVpt);
            this.canvas.renderAll();
        }
        
        return dataUrl;
    }

    onObjectSelected(e) {
        if (!this.eventBus) return;
        const selected = e.selected;
        if (!selected || selected.length === 0) return;
        
        // 排除底板
        if (selected[0] === this.artboard) {
            this.canvas.discardActiveObject();
            this.canvas.requestRenderAll();
            return;
        }

        // 我們只處理單選，多選先簡化不處理
        const obj = selected[0];
        
        // 傳遞物件屬性給面板 (需要 obj 的參照以便雙向綁定，或是傳遞 ID 讓屬性面板發送更新事件)
        // 最簡單的方法是直接把物件傳過去，但不符合嚴格解耦，不過針對這個編輯器規模是 OK 的
        this.eventBus.emit('CANVAS:OBJECT_SELECTED', {
            type: obj.type,
            fill: obj.fill,
            stroke: obj.stroke,
            strokeWidth: obj.strokeWidth,
            opacity: obj.opacity || 1,
            // 將整個物件傳過去以便直接修改 (在 PropertiesPanel)
            target: obj 
        });
    }

    onMouseDown(opt) {
        const evt = opt.e;
        // 支援滑鼠中鍵 (button === 1) 或 Alt 鍵拖曳作為快捷平移
        const isQuickPan = evt.button === 1 || evt.altKey;
        
        if (this.currentMode === 'panning' || isQuickPan) {
            this.isDraggingViewport = true;
            this.lastPosX = evt.clientX;
            this.lastPosY = evt.clientY;
            
            if (isQuickPan) {
                // 如果是快捷平移，避免觸發預設的選取或瀏覽器行為
                evt.preventDefault();
                evt.stopPropagation();
            }
        } else if (this.currentMode === 'selection' && (!opt.target || opt.target === this.artboard)) {
            // 紀錄可能正在拉選取框的起始點
            const pointer = this.canvas.getPointer(evt);
            this.isPossibleMarquee = true;
            this.marqueeStartX = pointer.x;
            this.marqueeStartY = pointer.y;
        }
    }

    onMouseMove(opt) {
        if (this.isDraggingViewport) {
            const e = opt.e;
            const vpt = this.canvas.viewportTransform;
            vpt[4] += e.clientX - this.lastPosX;
            vpt[5] += e.clientY - this.lastPosY;
            this.canvas.setViewportTransform(vpt); // 確保觸發重繪並儲存
            
            // 同步背景網格位置，產生立體感
            if (this.container) {
                this.container.style.backgroundPosition = `${vpt[4]}px ${vpt[5]}px`;
            }
            
            this.lastPosX = e.clientX;
            this.lastPosY = e.clientY;
        }
    }

    onMouseUp(opt) {
        if (this.isDraggingViewport) {
            this.canvas.setViewportTransform(this.canvas.viewportTransform);
            this.isDraggingViewport = false;
        } else if (this.isPossibleMarquee) {
            this.isPossibleMarquee = false;
            
            const pointer = this.canvas.getPointer(opt.e);
            const endX = pointer.x;
            const endY = pointer.y;
            
            const width = Math.abs(endX - this.marqueeStartX);
            const height = Math.abs(endY - this.marqueeStartY);
            
            // 必須要有一定範圍的拖曳，才視為畫框 (避免單純點擊)
            if (width > 10 && height > 10) {
                // 利用 setTimeout 確保原生的群組選取事件已經處理完畢
                setTimeout(() => {
                    const activeObjects = this.canvas.getActiveObjects();
                    // 如果原生沒有圈選到任何實體物件，我們就幫它生出一個紅色區域框
                    if (activeObjects.length === 0) {
                        const region = new fabric.Rect({
                            left: Math.min(this.marqueeStartX, endX),
                            top: Math.min(this.marqueeStartY, endY),
                            width: width,
                            height: height,
                            fill: 'rgba(255,0,0,0.05)',
                            stroke: 'red',
                            strokeWidth: 2,
                            strokeDashArray: [5, 5],
                            selectable: true,
                            transparentCorners: false,
                            cornerColor: 'red',
                            cornerStrokeColor: 'white'
                        });
                        region.isRegionBox = true; // 標記為特殊區域框
                        this.canvas.add(region);
                        this.canvas.setActiveObject(region);
                        this.canvas.requestRenderAll();
                    }
                }, 50);
            }
        }
    }
    
    onMouseWheel(opt) {
        const evt = opt.e;
        // 阻止預設捲動行為
        evt.preventDefault();
        evt.stopPropagation();
        
        let zoom = this.canvas.getZoom();
        // 根據滾輪方向計算縮放倍率 (deltaY < 0 向上滾動，放大)
        zoom *= 0.999 ** evt.deltaY;
        
        // 限制縮放比例
        if (zoom > 20) zoom = 20;
        if (zoom < 0.05) zoom = 0.05;
        
        // 針對游標所在位置進行縮放
        this.canvas.zoomToPoint({ x: evt.offsetX, y: evt.offsetY }, zoom);
        
        // 同步背景網格縮放 (CSS transform 也可以，或是透過改變大小，這裡先觸發視圖更新事件)
        
        // 廣播視圖變更事件
        if (this.eventBus) {
            this.eventBus.emit('CANVAS:VIEWPORT_CHANGED', { 
                scale: zoom, 
                vpt: this.canvas.viewportTransform 
            });
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        // 只有在選取模式下才開啟原生的多重框選功能
        this.canvas.selection = (mode === 'selection');
    }

    /**
     * 自訂物件控制點樣式 (為了契合手繪風格，隱藏預設藍色外框)
     */
    applyCustomStyles() {
        fabric.Object.prototype.set({
            transparentCorners: false,
            cornerColor: '#334155',
            cornerStrokeColor: '#ffffff',
            borderColor: '#334155',
            cornerSize: 10,
            padding: 5,
            cornerStyle: 'circle'
        });
    }

    zoomIn() {
        let zoom = this.canvas.getZoom();
        zoom *= 1.1; // 放大 10%
        if (zoom > 5) zoom = 5;
        this.canvas.zoomToPoint({ x: this.canvas.width / 2, y: this.canvas.height / 2 }, zoom);
        if(this.container) this.container.style.backgroundSize = `${20 * zoom}px ${20 * zoom}px`;
    }

    zoomOut() {
        let zoom = this.canvas.getZoom();
        zoom /= 1.1; // 縮小 10%
        if (zoom < 0.2) zoom = 0.2;
        this.canvas.zoomToPoint({ x: this.canvas.width / 2, y: this.canvas.height / 2 }, zoom);
        if(this.container) this.container.style.backgroundSize = `${20 * zoom}px ${20 * zoom}px`;
    }

    /**
     * 加入新物件
     */
    addObject(obj) {
        this.canvas.add(obj);
        this.canvas.setActiveObject(obj);
        this.canvas.requestRenderAll();
    }

    /**
     * 核心邏輯：撞牆邊界 (Bounding Box) 限制
     * 確保拖曳物件 (包含群組) 時絕對不會超出白色畫布邊緣
     */
    enforceBoundingBox(obj) {
        if (!obj || !this.artboard) return;

        obj.setCoords();

        const bounds = obj.getBoundingRect();
        const artboardBounds = this.artboard.getBoundingRect();
        let needsUpdate = false;

        // Ensure object is not larger than artboard
        if (bounds.width > artboardBounds.width || bounds.height > artboardBounds.height) {
            const scaleX = artboardBounds.width / (bounds.width / obj.scaleX);
            const scaleY = artboardBounds.height / (bounds.height / obj.scaleY);
            const scale = Math.min(scaleX, scaleY);
            
            // Only scale down if it exceeds bounds
            if (scale < obj.scaleX || scale < obj.scaleY) {
                obj.scale(scale);
                obj.setCoords();
                Object.assign(bounds, obj.getBoundingRect());
                needsUpdate = true;
            }
        }

        const zoom = this.canvas.getZoom();
        
        // 相對座標修正 (基於 artboard)
        if (bounds.left < artboardBounds.left) {
            obj.set('left', obj.left + (artboardBounds.left - bounds.left) / zoom);
            needsUpdate = true;
        } else if (bounds.left + bounds.width > artboardBounds.left + artboardBounds.width) {
            obj.set('left', obj.left - (bounds.left + bounds.width - (artboardBounds.left + artboardBounds.width)) / zoom);
            needsUpdate = true;
        }

        if (bounds.top < artboardBounds.top) {
            obj.set('top', obj.top + (artboardBounds.top - bounds.top) / zoom);
            needsUpdate = true;
        } else if (bounds.top + bounds.height > artboardBounds.top + artboardBounds.height) {
            obj.set('top', obj.top - (bounds.top + bounds.height - (artboardBounds.top + artboardBounds.height)) / zoom);
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            obj.setCoords();
        }
    }

    /**
     * 匯入底圖並自適應畫布尺寸
     * (符合 SDLC 階段四規則)
     */
    setBackgroundImage(url, callback) {
        fabric.Image.fromURL(url, (img) => {
            // 將底圖設為 Artboard 大小
            this.artboard.set({
                width: img.width,
                height: img.height
            });
            
            img.set({
                left: this.artboard.left,
                top: this.artboard.top,
                selectable: false,
                evented: false,
            });

            // 為了不被 Artboard 白色蓋住，把圖加到畫布上並確保在底層 (但高於 artboard)
            this.canvas.add(img);
            img.moveTo(1);

            this.centerArtboard();

            if (callback) callback();
        });
    }
}
