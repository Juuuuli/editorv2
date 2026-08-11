export default class KeyboardShortcuts {
    constructor(eventBus, canvasEngine) {
        this.eventBus = eventBus;
        this.canvasEngine = canvasEngine;
        this.history = [];
        this.historyIndex = -1;
        this.isRestoring = false; // 標記是否正在復原/重做中
        this._clipboard = null;
        
        this.bindEvents();
        // 初始化第一個歷史紀錄
        setTimeout(() => this.saveHistory(), 500);
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            // 避免在輸入框中觸發快捷鍵
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const isCtrl = e.ctrlKey || e.metaKey;
            
            // Delete / Backspace: 刪除選取的物件
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.deleteSelected();
            }

            // Ctrl + Z: 復原
            if (isCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl + Y 或 Ctrl + Shift + Z: 重做
            if (isCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
                e.preventDefault();
                this.redo();
            }
            
            // Ctrl + G: 群組與解散群組
            if (isCtrl && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.ungroupSelected();
                } else {
                    this.groupSelected();
                }
            }

            // Ctrl + C: 複製
            if (isCtrl && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                this.copySelected();
            }

            // Ctrl + V: 貼上
            if (isCtrl && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                this.pasteSelected();
            }
        });

        // 監聽畫布變化來儲存歷史紀錄 (防抖)
        let debounceTimer;
        this.eventBus.on('CANVAS:DIRTY', () => {
            if (this.isRestoring) return; // 如果正在復原，不要觸發存檔，避免洗掉重做紀錄
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.saveHistory();
            }, 300);
        });
    }

    deleteSelected() {
        const activeObjects = this.canvasEngine.canvas.getActiveObjects();
        if (activeObjects.length > 0) {
            activeObjects.forEach(obj => {
                if (obj !== this.canvasEngine.artboard) {
                    this.canvasEngine.canvas.remove(obj);
                }
            });
            this.canvasEngine.canvas.discardActiveObject();
            this.canvasEngine.canvas.requestRenderAll();
            this.eventBus.emit('CANVAS:DIRTY', true);
        }
    }

    groupSelected() {
        const activeObject = this.canvasEngine.canvas.getActiveObject();
        // 必須是選取了多個物件 (ActiveSelection) 才能組成群組
        if (activeObject && activeObject.type === 'activeSelection') {
            activeObject.toGroup();
            this.canvasEngine.canvas.requestRenderAll();
            this.eventBus.emit('CANVAS:DIRTY', true);
        }
    }

    ungroupSelected() {
        const activeObject = this.canvasEngine.canvas.getActiveObject();
        // 必須是選取了群組 (Group) 才能解散
        if (activeObject && activeObject.type === 'group' && !activeObject.isTable) {
            activeObject.toActiveSelection();
            this.canvasEngine.canvas.requestRenderAll();
            this.eventBus.emit('CANVAS:DIRTY', true);
        }
    }

    copySelected() {
        const activeObject = this.canvasEngine.canvas.getActiveObject();
        if (activeObject && activeObject !== this.canvasEngine.artboard) {
            const customProps = ['layerName', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights', 'cellW', 'cellH', 'hasHeader', 'isHanddrawn', 'isQRCode', 'qrOptions', 'isCell', 'rowIndex', 'colIndex', 'isIcon', 'isSticky'];
            activeObject.clone((cloned) => {
                this._clipboard = cloned;
            }, customProps);
        }
    }

    pasteSelected() {
        if (!this._clipboard) return;

        const customProps = ['layerName', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights', 'cellW', 'cellH', 'hasHeader', 'isHanddrawn', 'isQRCode', 'qrOptions', 'isCell', 'rowIndex', 'colIndex', 'isIcon', 'isSticky'];
        
        this._clipboard.clone((clonedObj) => {
            this.canvasEngine.canvas.discardActiveObject();
            
            clonedObj.set({
                left: clonedObj.left + 20,
                top: clonedObj.top + 20,
                evented: true,
            });

            if (clonedObj.type === 'activeSelection') {
                clonedObj.canvas = this.canvasEngine.canvas;
                clonedObj.forEachObject((obj) => {
                    this.canvasEngine.canvas.add(obj);
                });
                clonedObj.setCoords();
            } else {
                this.canvasEngine.canvas.add(clonedObj);
            }

            this._clipboard.top += 20;
            this._clipboard.left += 20;

            this.canvasEngine.canvas.setActiveObject(clonedObj);
            this.canvasEngine.canvas.requestRenderAll();
            this.eventBus.emit('CANVAS:DIRTY', true);
        }, customProps);
    }

    saveHistory() {
        if (!this.canvasEngine.currentPageId) return;
        
        // 取得當前除了 artboard 以外的所有物件狀態
        const objects = this.canvasEngine.canvas.getObjects().filter(obj => obj !== this.canvasEngine.artboard);
        const json = objects.map(obj => {
            try {
                return obj.toObject(['layerName']);
            } catch (e) {
                console.error("[KeyboardShortcuts] toObject failed during copy, skipping:", e);
                return null;
            }
        }).filter(Boolean);
        
        // 如果不是在最新紀錄，清除後面的歷史
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push({
            pageId: this.canvasEngine.currentPageId,
            state: json
        });
        
        // 限制歷史紀錄長度
        if (this.history.length > 20) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadStateFromHistory();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadStateFromHistory();
        }
    }

    loadStateFromHistory() {
        const record = this.history[this.historyIndex];
        if (!record) return;
        
        this.isRestoring = true;

        // 如果復原到的狀態與當前頁面不同，要先切換頁面
        if (record.pageId !== this.canvasEngine.currentPageId) {
            this.eventBus.emit('PAGE:SWITCH', { newPageId: record.pageId });
            // TODO: 通知 ThumbnailsPanel 同步切換 UI，這裡略過因為稍微複雜，目前先專注於單頁內的復原
        }

        // 清空畫布 (保留底板)
        const objects = this.canvasEngine.canvas.getObjects();
        objects.forEach(obj => {
            if (obj !== this.canvasEngine.artboard) {
                this.canvasEngine.canvas.remove(obj);
            }
        });

        if (record.state && record.state.length > 0) {
            // 需要使用 fabric 內建的方法還原，避免 this 跑掉
            fabric.util.enlivenObjects(record.state, (objs) => {
                objs.forEach(obj => {
                    this.canvasEngine.canvas.add(obj);
                });
                this.canvasEngine.canvas.requestRenderAll();
                this.canvasEngine.updateThumbnail();
                // 延遲一點點再解除標記，確保所有同步事件都已經跑完
                setTimeout(() => this.isRestoring = false, 50);
            });
        } else {
            this.canvasEngine.canvas.requestRenderAll();
            this.canvasEngine.updateThumbnail();
            setTimeout(() => this.isRestoring = false, 50);
        }
    }
}
