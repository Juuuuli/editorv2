/**
 * YjsAdapter.js
 * 負責 Fabric.js 與 Yjs 的雙向綁定 (Two-way Data Binding)
 * 1. 攔截 Fabric.js 的修改/新增/刪除，轉化為 Yjs 的操作
 * 2. 監聽 Yjs 的 observe 事件，並更新 Fabric.js 畫布
 */
import { fabric } from 'fabric';

export default class YjsAdapter {
    constructor(canvas, ydoc, eventBus, pageId = 'page_1') {
        this.canvas = canvas;
        this.ydoc = ydoc;
        this.eventBus = eventBus;
        this.pageId = pageId;
        
        this.yObjects = this.ydoc.getArray(`page_objects_${this.pageId}`);
        this.isSyncing = false; // 防止無限迴圈
        this._yjsObserver = null;
        
        // 判斷是否為 Viewer
        this.isViewer = false;
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            if (searchParams.get('role') === 'viewer') {
                this.isViewer = true;
            }
        }

        this.bindFabricEvents();
        this.bindYjsEvents();
        this.bindPageEvents();
        
        // 初始載入：如果是訪客加入，且 Yjs 已有資料，則同步到本地畫布
        if (this.yObjects.length > 0) {
            this.syncCanvasFromYjs();
        } else {
            // 如果是房主初始建立，且畫布上有物件，推送至 Yjs
            this.pushLocalToYjs();
        }
    }

    bindPageEvents() {
        if (!this.eventBus) return;
        
        // 監聽頁面切換
        this.eventBus.on('PAGE:SWITCH', ({ newPageId }) => {
            if (this.pageId === newPageId) return;
            
            this.isSyncing = true; // 暫停上傳本地變更，等待 CanvasEngine 載入完畢
            
            // 清理舊的 Observer
            if (this._yjsObserver) {
                this.yObjects.unobserveDeep(this._yjsObserver);
            }
            
            this.pageId = newPageId;
            this.yObjects = this.ydoc.getArray(`page_objects_${this.pageId}`);
            this.bindYjsEvents();
            
            // 延遲一點點，確保 CanvasEngine 本地的 loadPageState 已經完成，我們再來覆寫(或被覆寫)
            setTimeout(() => {
                if (this.yObjects.length > 0) {
                    this.syncCanvasFromYjs();
                } else {
                    this.pushLocalToYjs();
                    this.isSyncing = false;
                }
            }, 100);
        });
    }

    /**
     * 從 Fabric 到 Yjs (Local -> Remote)
     */
    bindFabricEvents() {
        this.canvas.on('object:added', (e) => {
            if (this.isSyncing || this.isViewer) return;
            // 過濾底板與輔助線
            if (e.target === this.canvas.artboard || e.target.isSmartGuide || e.target.excludeFromExport) return;
            
            if (!e.target.id) e.target.id = fabric.util.getRandomUid();
            
            const objJson = e.target.toJSON(['id', 'layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
            
            this.ydoc.transact(() => {
                const yMap = new Y.Map();
                for (const key in objJson) {
                    yMap.set(key, objJson[key]);
                }
                this.yObjects.push([yMap]);
            });
        });

        this.canvas.on('object:modified', (e) => {
            if (this.isSyncing || this.isViewer) return;
            const target = e.target;
            if (!target || !target.id) return;
            
            const objJson = target.toJSON(['id', 'layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
            
            this.ydoc.transact(() => {
                const yArr = this.yObjects.toArray();
                const idx = yArr.findIndex(yMap => yMap.get('id') === target.id);
                if (idx !== -1) {
                    const yMap = yArr[idx];
                    for (const key in objJson) {
                        if (yMap.get(key) !== objJson[key]) {
                            yMap.set(key, objJson[key]);
                        }
                    }
                }
            });
        });

        this.canvas.on('object:removed', (e) => {
            if (this.isSyncing || this.isViewer) return;
            const target = e.target;
            if (!target || !target.id) return;
            
            this.ydoc.transact(() => {
                const yArr = this.yObjects.toArray();
                const idx = yArr.findIndex(yMap => yMap.get('id') === target.id);
                if (idx !== -1) {
                    this.yObjects.delete(idx, 1);
                }
            });
        });
    }

    /**
     * 將當前畫布的所有有效物件強制推送至 Yjs (例如初次連線為房主)
     */
    pushLocalToYjs() {
        if (this.yObjects.length > 0) return; // 已經有資料就不蓋掉
        
        const objects = this.canvas.getObjects().filter(obj => obj !== this.canvas.artboard && !obj.isSmartGuide && !obj.excludeFromExport);
        if (objects.length === 0) return;

        this.ydoc.transact(() => {
            objects.forEach(obj => {
                if (!obj.id) obj.id = fabric.util.getRandomUid();
                const objJson = obj.toJSON(['id', 'layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
                
                const yMap = new Y.Map();
                for (const key in objJson) {
                    yMap.set(key, objJson[key]);
                }
                this.yObjects.push([yMap]);
            });
        });
    }

    /**
     * 從 Yjs 到 Fabric (Remote -> Local)
     */
    bindYjsEvents() {
        this._yjsObserver = (events) => {
            if (events.length > 0) {
                const isLocal = events[0].transaction.local;
                if (!isLocal) {
                    this.syncCanvasFromYjs();
                }
            }
        };
        this.yObjects.observeDeep(this._yjsObserver);
    }

    /**
     * 重新根據 Yjs 資料同步整個 Canvas
     */
    syncCanvasFromYjs() {
        this.isSyncing = true;
        
        const yArr = this.yObjects.toArray();
        const yJsonList = yArr.map(yMap => yMap.toJSON());
        
        const activeObject = this.canvas.getActiveObject();
        const activeId = activeObject ? activeObject.id : null;

        fabric.util.enlivenObjects(yJsonList, (enlivenedObjects) => {
            // 清除畫布，但保留 artboard 等不參與同步的物件
            const objects = this.canvas.getObjects();
            objects.forEach(obj => {
                if (obj !== this.canvas.artboard && !obj.isSmartGuide && !obj.excludeFromExport) {
                    this.canvas.remove(obj);
                }
            });

            enlivenedObjects.forEach((obj) => {
                // 如果是 Viewer 模式，鎖定所有物件
                if (this.isViewer) {
                    obj.set({
                        selectable: false,
                        evented: false,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        lockRotation: true
                    });
                }
                
                this.canvas.add(obj);
                if (activeId && obj.id === activeId && !this.isViewer) {
                    this.canvas.setActiveObject(obj);
                }
            });
            
            // 如果是 Viewer 模式，關閉畫布的群組選取
            if (this.isViewer) {
                this.canvas.selection = false;
                this.canvas.discardActiveObject();
                
                // 強制將浮動工具列等隱藏，可以透過觸發一個取消選取的事件
                this.canvas.fire('selection:cleared');
            }
            
            this.canvas.requestRenderAll();
            this.isSyncing = false;
        }, 'fabric');
    }

    destroy() {
        if (this._yjsObserver && this.yObjects) {
            this.yObjects.unobserveDeep(this._yjsObserver);
        }
    }
}
