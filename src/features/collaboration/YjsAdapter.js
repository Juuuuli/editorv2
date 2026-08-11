/**
 * YjsAdapter.js
 * 負責 Fabric.js 與 Yjs 的雙向綁定 (Two-way Data Binding)
 * 1. 攔截 Fabric.js 的修改/新增/刪除，轉化為 Yjs 的操作
 * 2. 監聽 Yjs 的 observe 事件，並更新 Fabric.js 畫布
 */
import { fabric } from 'fabric';

export default class YjsAdapter {
    constructor(canvas, ydoc, pageId = 'page_1') {
        this.canvas = canvas;
        this.ydoc = ydoc;
        this.pageId = pageId;
        
        // 取得該頁面的 Y.Array (負責存放物件)
        this.yObjects = this.ydoc.getArray(`page_objects_${this.pageId}`);
        
        this.isSyncing = false; // 防止無限迴圈

        this.bindFabricEvents();
        this.bindYjsEvents();
    }

    /**
     * 從 Fabric 到 Yjs (Local -> Remote)
     */
    bindFabricEvents() {
        this.canvas.on('object:added', (e) => {
            if (this.isSyncing) return;
            if (!e.target.id) e.target.id = fabric.util.getRandomUid();
            
            const objJson = e.target.toJSON(['id']);
            
            this.ydoc.transact(() => {
                // 將 JSON 轉為 Y.Map
                const yMap = new Y.Map();
                for (const key in objJson) {
                    yMap.set(key, objJson[key]);
                }
                this.yObjects.push([yMap]);
            });
        });

        this.canvas.on('object:modified', (e) => {
            if (this.isSyncing) return;
            const target = e.target;
            if (!target || !target.id) return;
            
            const objJson = target.toJSON(['id']);
            
            // 尋找對應的 Y.Map 並更新
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
            if (this.isSyncing) return;
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
     * 從 Yjs 到 Fabric (Remote -> Local)
     */
    bindYjsEvents() {
        this.yObjects.observeDeep((events) => {
            if (events.length > 0) {
                // 有來自遠端的變更，或者本地的變更 (但我們只關心如何反應在畫面上)
                // 若這不是本地觸發的 (isLocal = false)
                const isLocal = events[0].transaction.local;
                if (!isLocal) {
                    this.syncCanvasFromYjs();
                }
            }
        });
    }

    /**
     * 重新根據 Yjs 資料同步整個 Canvas
     * (實務上可以針對 delta 做增量更新，此處為簡單實作)
     */
    syncCanvasFromYjs() {
        this.isSyncing = true;
        
        const yArr = this.yObjects.toArray();
        const yJsonList = yArr.map(yMap => yMap.toJSON());
        
        // 暫存目前的選取狀態
        const activeObject = this.canvas.getActiveObject();
        const activeId = activeObject ? activeObject.id : null;

        // 載入 JSON 至 Canvas
        fabric.util.enlivenObjects(yJsonList, (enlivenedObjects) => {
            this.canvas.clear();
            enlivenedObjects.forEach((obj) => {
                this.canvas.add(obj);
                if (activeId && obj.id === activeId) {
                    this.canvas.setActiveObject(obj);
                }
            });
            this.canvas.requestRenderAll();
            this.isSyncing = false;
        }, 'fabric');
    }

    destroy() {
        // 清理綁定
    }
}
