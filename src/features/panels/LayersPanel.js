export default class LayersPanel {
    constructor(eventBus, canvasEngine) {
        this.eventBus = eventBus;
        this.canvasEngine = canvasEngine;
        this.container = document.getElementById('panel-layers');
        
        this.draggedItem = null;
        this.bindEvents();
    }

    bindEvents() {
        // 當畫布有任何異動，重新渲染圖層清單
        this.canvasEngine.canvas.on('object:added', () => this.renderLayers());
        this.canvasEngine.canvas.on('object:removed', () => this.renderLayers());
        this.canvasEngine.canvas.on('object:modified', () => this.renderLayers());
        
        this.eventBus.on('WORKSPACE:MODE_CHANGED', () => this.renderLayers());
        this.eventBus.on('PAGE:SWITCH', () => setTimeout(() => this.renderLayers(), 50)); // 等待 loadPageState 完成

        // 綁定圖層操作事件 (使用事件委派)
        if (this.container) {
            this.container.addEventListener('click', (e) => {
                const layerItem = e.target.closest('.layer-item');
                if (!layerItem) return;

                const objIndex = parseInt(layerItem.dataset.index);
                const objects = this.canvasEngine.canvas.getObjects();
                const obj = objects[objIndex];
                if (!obj) return;

                // 點擊隱藏按鈕
                if (e.target.closest('.layer-toggle-visible')) {
                    obj.set('visible', !obj.visible);
                    this.canvasEngine.canvas.requestRenderAll();
                    this.renderLayers();
                    return;
                }

                // 點擊鎖定按鈕
                if (e.target.closest('.layer-toggle-lock')) {
                    const isLocked = obj.lockMovementX;
                    obj.set({
                        lockMovementX: !isLocked,
                        lockMovementY: !isLocked,
                        lockRotation: !isLocked,
                        lockScalingX: !isLocked,
                        lockScalingY: !isLocked,
                        selectable: isLocked, // 解鎖才能選取
                        evented: isLocked
                    });
                    this.canvasEngine.canvas.discardActiveObject();
                    this.canvasEngine.canvas.requestRenderAll();
                    this.renderLayers();
                    return;
                }

                // 單純點擊圖層 -> 在畫布上選取該物件
                if (obj.selectable !== false) {
                    this.canvasEngine.canvas.setActiveObject(obj);
                    this.canvasEngine.canvas.requestRenderAll();
                }
            });

            // 綁定拖曳排序事件
            this.container.addEventListener('dragstart', (e) => {
                const layerItem = e.target.closest('.layer-item');
                if (layerItem) {
                    this.draggedItem = layerItem;
                    setTimeout(() => layerItem.classList.add('opacity-50'), 0);
                }
            });

            this.container.addEventListener('dragend', (e) => {
                if (this.draggedItem) {
                    this.draggedItem.classList.remove('opacity-50');
                    this.draggedItem = null;
                }
                document.querySelectorAll('.layer-item').forEach(item => {
                    item.classList.remove('border-t-2', 'border-indigo-500', 'border-b-2');
                });
            });

            this.container.addEventListener('dragover', (e) => {
                e.preventDefault();
                const layerItem = e.target.closest('.layer-item');
                if (layerItem && layerItem !== this.draggedItem) {
                    const rect = layerItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    // 如果滑鼠在元素上半部，顯示上方插入線，否則顯示下方插入線
                    layerItem.classList.remove('border-t-2', 'border-indigo-500', 'border-b-2');
                    if (e.clientY < midY) {
                        layerItem.classList.add('border-t-2', 'border-indigo-500');
                    } else {
                        layerItem.classList.add('border-b-2', 'border-indigo-500');
                    }
                }
            });

            this.container.addEventListener('dragleave', (e) => {
                const layerItem = e.target.closest('.layer-item');
                if (layerItem) {
                    layerItem.classList.remove('border-t-2', 'border-indigo-500', 'border-b-2');
                }
            });

            this.container.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetItem = e.target.closest('.layer-item');
                if (targetItem && this.draggedItem && targetItem !== this.draggedItem) {
                    const fromIndex = parseInt(this.draggedItem.dataset.index);
                    const toIndex = parseInt(targetItem.dataset.index);
                    
                    const rect = targetItem.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    let insertIndex = toIndex;
                    
                    // 因為清單是反向渲染 (視覺上越上面 index 越大)
                    // 如果放在 target 的「上方」，表示 z-index 要比 target 大，所以放到 target 的下一個位置
                    // 注意這裡要根據 UI 顯示順序與陣列順序的對應來計算
                    const objects = this.canvasEngine.canvas.getObjects();
                    const obj = objects[fromIndex];
                    
                    if (e.clientY < midY) {
                        // 放到 target 上方 -> z-index 較大
                        insertIndex = toIndex >= fromIndex ? toIndex : toIndex + 1;
                    } else {
                        // 放到 target 下方 -> z-index 較小
                        insertIndex = toIndex < fromIndex ? toIndex : toIndex - 1;
                    }

                    this.canvasEngine.canvas.moveTo(obj, insertIndex);
                    this.canvasEngine.canvas.requestRenderAll();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                    this.renderLayers();
                }
            });
        }
    }

    renderLayers() {
        if (!this.container) return;
        this.container.innerHTML = '';

        const objects = this.canvasEngine.canvas.getObjects();
        const activeObject = this.canvasEngine.canvas.getActiveObject();

        if (objects.length <= 1) {
            // 只有 artboard 或是完全沒有
            this.container.innerHTML = `<div class="text-sm text-slate-500 text-center py-10">目前沒有圖層</div>`;
            return;
        }

        // 反向遍歷，越上層 (index 越大) 顯示在清單越上方
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            if (obj === this.canvasEngine.artboard) continue; // 不顯示底板圖層

            // 如果該物件還沒有固定名稱，幫它產一個
            if (!obj.layerName) {
                const typeName = obj.type === 'rect' ? '矩形' :
                                 obj.type === 'circle' ? '圓形' :
                                 obj.type === 'path' ? '筆觸' : obj.type;
                this.layerCounter = (this.layerCounter || 0) + 1;
                obj.layerName = `${typeName} ${this.layerCounter}`;
            }

            const isVisible = obj.visible !== false;
            const isLocked = obj.lockMovementX === true;
            const isActive = obj === activeObject;

            const bgClass = isActive ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-transparent';
            const iconClass = obj.type === 'rect' ? 'fa-square' :
                              obj.type === 'circle' ? 'fa-circle' : 'fa-pen-nib';

            const html = `
                <div class="layer-item flex items-center justify-between p-2 rounded cursor-pointer border hover:border-indigo-300 transition shadow-sm ${bgClass}" 
                     data-index="${i}" draggable="true">
                    
                    <div class="flex items-center gap-3 flex-1 pointer-events-none">
                        <i class="fas ${iconClass} text-slate-400 w-4 text-center"></i>
                        <span class="text-xs font-bold text-slate-700 select-none">${obj.layerName}</span>
                    </div>

                    <div class="flex items-center gap-1 z-10">
                        <button class="layer-toggle-lock p-1.5 rounded hover:bg-slate-200 text-slate-400 ${isLocked ? 'text-rose-500' : ''}" title="${isLocked ? '解鎖' : '鎖定'}">
                            <i class="fas ${isLocked ? 'fa-lock' : 'fa-unlock'} text-[10px]"></i>
                        </button>
                        <button class="layer-toggle-visible p-1.5 rounded hover:bg-slate-200 text-slate-400 ${!isVisible ? 'text-slate-300 opacity-50' : ''}" title="${isVisible ? '隱藏' : '顯示'}">
                            <i class="fas ${isVisible ? 'fa-eye' : 'fa-eye-slash'} text-[10px]"></i>
                        </button>
                        <div class="cursor-move p-1 text-slate-300 hover:text-slate-500" title="拖曳排序">
                            <i class="fas fa-grip-vertical text-[10px]"></i>
                        </div>
                    </div>
                </div>
            `;
            this.container.insertAdjacentHTML('beforeend', html);
        }
    }
}
