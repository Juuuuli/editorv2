/**
 * YjsAdapter.js
 * 負責 Fabric.js 與 Yjs 的雙向綁定 (Two-way Data Binding)
 * 1. 攔截 Fabric.js 的修改/新增/刪除，轉化為 Yjs 的操作
 * 2. 監聽 Yjs 的 observe 事件，並更新 Fabric.js 畫布
 */
import { fabric } from 'fabric';
import * as Y from 'yjs';

export default class YjsAdapter {
    constructor(canvas, ydoc, provider, eventBus, pageId = 'page_1') {
        this.canvas = canvas;
        this.ydoc = ydoc;
        this.provider = provider;
        this.eventBus = eventBus;
        this.pageId = pageId;
        
        this.yObjects = this.ydoc.getArray(`page_objects_${this.pageId}`);
        this.yPages = this.ydoc.getArray('project_pages');
        
        this.isSyncing = false; // 防止無限迴圈
        this._yjsObserver = null;
        this._pagesObserver = null;
        
        // 判斷是否為 Viewer (統一由 main.js 控制 body class)
        this.isViewer = false;
        if (typeof document !== 'undefined') {
            this.isViewer = document.body.classList.contains('viewer-mode');
        }

        this.isSyncing = true;
        this.isPageSwitching = false;
        this._pendingInitialSync = true; // 標記等待 Canvas 載入完成再同步

        this.bindFabricEvents();
        this.bindYjsEvents();
        this.bindPageEvents();
    }

    bindPageEvents() {
        if (!this.eventBus) return;
        
        this.eventBus.on('CANVAS:PAGE_LOADING_START', () => {
            this.isPageSwitching = true;
        });
        
        this.eventBus.on('CANVAS:PAGE_LOADING_END', () => {
            this.isPageSwitching = false;
            
            if (this._pendingInitialSync) {
                this._pendingInitialSync = false;
                if (this.yObjects && this.yObjects.length > 0) {
                    this.syncCanvasFromYjs();
                } else {
                    this.pushLocalToYjs();
                }
                this.isSyncing = false;
            }
        });
        
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
            
            this._pendingInitialSync = true;
        });
        
        // 監聽 ThumbnailsPanel 的本地頁面清單變更，推送到 Yjs
        this.eventBus.on('PAGE:LIST_CHANGED', ({ pages }) => {
            if (this.isViewer) return;
            
            this.ydoc.transact(() => {
                const currentPages = this.yPages.toArray().map(yMap => yMap.get('id'));
                const newPages = pages.map(p => p.id);
                
                if (JSON.stringify(currentPages) !== JSON.stringify(newPages)) {
                    this.yPages.delete(0, this.yPages.length);
                    
                    pages.forEach(p => {
                        const yMap = new Y.Map();
                        yMap.set('id', p.id);
                        // 不透過 Yjs 同步 thumbnail 避免影響即時性與 Firebase 負載
                        this.yPages.push([yMap]);
                    });
                }
            });
        });

        // 監聽專案載入完成，同步正確的 pageId
        this.eventBus.on('PROJECT:IMPORTED', ({ projectData }) => {
            if (projectData && projectData.currentPageId) {
                const newPageId = projectData.currentPageId;
                
                this.isSyncing = true;
                
                if (this._yjsObserver) {
                    this.yObjects.unobserveDeep(this._yjsObserver);
                }
                
                this.pageId = newPageId;
                this.yObjects = this.ydoc.getArray(`page_objects_${this.pageId}`);
                this.bindYjsEvents();
                
                this._pendingInitialSync = true;
            }
        });
    }

    /**
     * 從 Fabric 到 Yjs (Local -> Remote)
     */
    bindFabricEvents() {
        this.canvas.on('object:added', (e) => {
            if (this.isViewer || this.isPageSwitching || e.target.isRemoteSync) return;
            // 過濾底板與輔助線
            if (e.target.id === 'artboard' || e.target.isArtboard || e.target === this.canvas.artboard || e.target.isSmartGuide || e.target.excludeFromExport || e.target.isBackgroundTemplate) return;
            
            if (!e.target.id) e.target.id = 'obj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
            
            let objJson;
            try {
                objJson = e.target.toJSON(['id', 'layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
            } catch (err) {
                console.error("[YjsAdapter] toJSON failed for object, skipping sync:", err);
                return;
            }
            
            this.ydoc.transact(() => {
                const yMap = new Y.Map();
                for (const key in objJson) {
                    yMap.set(key, objJson[key]);
                }
                this.yObjects.push([yMap]);
            });
        });

        this.canvas.on('object:modified', (e) => {
            if (this.isViewer || this.isPageSwitching) return;
            const target = e.target;
            if (!target || !target.id || target.isBackgroundTemplate) return;
            
            let objJson;
            try {
                objJson = target.toJSON(['id', 'layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
            } catch (err) {
                console.error("[YjsAdapter] toJSON failed for object modification, skipping sync:", err);
                return;
            }
            
            this.ydoc.transact(() => {
                const yArr = this.yObjects.toArray();
                const idx = yArr.findIndex(yMap => yMap.get('id') === target.id);
                if (idx !== -1) {
                    const yMap = yArr[idx];
                    for (const key in objJson) {
                        // 使用深層比對，避免將沒有變更的大型物件 (如圖片的 src、Path 的點陣列) 重複推送到 Firebase
                        if (JSON.stringify(yMap.get(key)) !== JSON.stringify(objJson[key])) {
                            yMap.set(key, objJson[key]);
                        }
                    }
                }
            });
        });

        this.canvas.on('object:removed', (e) => {
            if (this.isViewer || this.isPageSwitching || e.target.isRemoteSync) return;
            const target = e.target;
            if (!target || !target.id || target.isBackgroundTemplate) return;
            
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
        
        const objects = this.canvas.getObjects().filter(obj => obj.id !== 'artboard' && !obj.isArtboard && obj !== this.canvas.artboard && !obj.isSmartGuide && !obj.excludeFromExport && !obj.isBackgroundTemplate);
        if (objects.length === 0) return;

        this.ydoc.transact(() => {
            objects.forEach(obj => {
                if (!obj.id) obj.id = 'obj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
                
                let objJson;
                try {
                    objJson = obj.toJSON(['id', 'layerName', 'isQRCode', 'qrOptions', 'selectable', 'evented', 'isRegionBox', 'isSmartToolOverlay', 'isBackgroundTemplate', 'isTable', 'tableConfig', 'tableRows', 'tableCols', 'colWidths', 'rowHeights']);
                } catch (err) {
                    console.error("[YjsAdapter] toJSON failed for object, skipping push:", err);
                    return;
                }
                
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
        
        if (!this._pagesObserver) {
            this._pagesObserver = (events) => {
                if (events.length > 0) {
                    const isLocal = events[0].transaction.local;
                    if (!isLocal) {
                        const pages = this.yPages.toArray().map(yMap => ({
                            id: yMap.get('id')
                        }));
                        if (pages.length > 0) {
                            this.eventBus.emit('PAGE:REMOTE_SYNC', { pages });
                        }
                    }
                }
            };
            this.yPages.observeDeep(this._pagesObserver);
            
            // 初次載入時，如果 yPages 已經有資料，手動觸發一次同步
            if (this.yPages.length > 0) {
                const initialPages = this.yPages.toArray().map(yMap => ({
                    id: yMap.get('id')
                }));
                this.eventBus.emit('PAGE:REMOTE_SYNC', { pages: initialPages });
            }
        }
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

        if (this.eventBus) {
            this.eventBus.emit('CANVAS:HISTORY_PAUSE');
        }

        const currentObjects = this.canvas.getObjects().filter(obj => 
            obj.id !== 'artboard' && !obj.isArtboard && obj !== this.canvas.artboard && !obj.isSmartGuide && !obj.excludeFromExport
        );

        // 1. 移除 (本地有，但 Yjs 已經沒有)
        const objectsToRemove = currentObjects.filter(obj => !yJsonList.find(y => y.id === obj.id));
        objectsToRemove.forEach(obj => {
            obj.isRemoteSync = true;
            this.canvas.remove(obj);
            obj.isRemoteSync = false;
        });

        // 2. 更新 (兩邊都有) 與 收集新增
        const objectsToAdd = [];
        yJsonList.forEach(yJson => {
            const existingObj = currentObjects.find(o => o.id === yJson.id);
            if (existingObj) {
                existingObj.set(yJson);
                if (this.isViewer) {
                    existingObj.set({
                        selectable: false,
                        evented: false,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        lockRotation: true,
                        editable: false
                    });
                }
                existingObj.setCoords();
            } else {
                objectsToAdd.push(yJson);
            }
        });

        // 3. 新增 (Yjs 有，但本地沒有)
        const finalizeSync = () => {
            if (this.isViewer) {
                this.canvas.selection = false;
                this.canvas.discardActiveObject();
                this.canvas.fire('selection:cleared');
            }
            this.canvas.requestRenderAll();
            
            if (this.eventBus) {
                this.eventBus.emit('CANVAS:HISTORY_RESUME');
                this.eventBus.emit('CANVAS:DIRTY', true);
            }
            this.isSyncing = false;
        };

        if (objectsToAdd.length > 0) {
            fabric.util.enlivenObjects(objectsToAdd, (enlivenedObjects) => {
                enlivenedObjects.forEach((obj) => {
                    obj.isRemoteSync = true;
                    if (this.isViewer) {
                        obj.set({
                            selectable: false,
                            evented: false,
                            lockMovementX: true,
                            lockMovementY: true,
                            lockScalingX: true,
                            lockScalingY: true,
                            lockRotation: true,
                            editable: false
                        });
                    }
                    this.canvas.add(obj);
                    obj.isRemoteSync = false;
                    
                    if (activeId && obj.id === activeId && !this.isViewer) {
                        this.canvas.setActiveObject(obj);
                    }
                });
                finalizeSync();
            }, 'fabric');
        } else {
            finalizeSync();
        }
    }

    destroy() {
        if (this._yjsObserver && this.yObjects) {
            this.yObjects.unobserveDeep(this._yjsObserver);
        }
    }
}
