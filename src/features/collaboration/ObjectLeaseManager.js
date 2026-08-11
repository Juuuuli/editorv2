/**
 * ObjectLeaseManager.js
 * 物件租約與鎖定管理器，防止多人同時編輯同一個物件
 */

export default class ObjectLeaseManager {
    constructor(canvas, awareness) {
        this.canvas = canvas;
        this.awareness = awareness;
        this.localClientId = awareness.clientID;
        
        this.bindEvents();
    }

    bindEvents() {
        if (!this.awareness || !this.canvas) return;

        // 當本地選取物件時，發布租約
        this.canvas.on('selection:created', this.handleLocalSelection.bind(this));
        this.canvas.on('selection:updated', this.handleLocalSelection.bind(this));
        this.canvas.on('selection:cleared', () => {
            this.awareness.setLocalStateField('selection', []);
        });

        // 當收到遠端 Awareness 變更時，鎖定他人選取的物件
        this.awareness.on('change', () => {
            this.updateObjectLocks();
        });
    }

    handleLocalSelection(e) {
        const selectedObjects = e.selected || [];
        const objectIds = selectedObjects.map(obj => obj.id).filter(id => !!id);
        this.awareness.setLocalStateField('selection', objectIds);
    }

    updateObjectLocks() {
        const states = this.awareness.getStates();
        const lockedIds = new Map(); // objectId -> user

        // 收集所有被其他人鎖定的物件
        states.forEach((state, clientId) => {
            if (clientId === this.localClientId) return;
            if (state.selection && state.user) {
                state.selection.forEach(id => {
                    lockedIds.set(id, state.user);
                });
            }
        });

        // 走訪畫布中所有物件，設定鎖定狀態
        this.canvas.getObjects().forEach(obj => {
            if (!obj.id) return;

            if (lockedIds.has(obj.id)) {
                // 被其他人鎖定
                const lockingUser = lockedIds.get(obj.id);
                obj.set({
                    selectable: false,
                    evented: false,
                    hoverCursor: 'not-allowed',
                    stroke: lockingUser.color || 'red',
                    strokeWidth: 2,
                    strokeDashArray: [5, 5]
                });
                
                // 如果我們剛好也選中了這個物件，強制取消我們的選取
                const activeObj = this.canvas.getActiveObject();
                if (activeObj && activeObj.id === obj.id) {
                    this.canvas.discardActiveObject();
                }
            } else {
                // 恢復正常狀態 (假設原先沒有自訂特殊的 border)
                // 這裡實務上應該要存下物件的原始 stroke 狀態再恢復
                // 簡單示範：
                if (obj.hoverCursor === 'not-allowed') {
                    obj.set({
                        selectable: true,
                        evented: true,
                        hoverCursor: 'move',
                        stroke: null,
                        strokeWidth: 0,
                        strokeDashArray: null
                    });
                }
            }
        });

        this.canvas.requestRenderAll();
    }

    destroy() {
        // 解除綁定
    }
}
