export default class FloatingToolsManager {
    constructor(canvasEngine, eventBus) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;

        // Buttons
        this.btnFullscreen = document.getElementById('btn-tool-fullscreen');
        this.btnLayers = document.getElementById('btn-tool-layers');
        this.btnComments = document.getElementById('btn-tool-comments');

        // Popovers
        this.popoverLayers = document.getElementById('popover-quick-layers');
        this.popoverComments = document.getElementById('popover-comments');

        // Close Buttons
        this.btnCloseLayers = document.getElementById('btn-close-quick-layers');
        this.btnCloseComments = document.getElementById('btn-close-comments');

        // Lists
        this.layersList = document.getElementById('quick-layers-list');

        this.bindEvents();
    }

    bindEvents() {
        // Fullscreen Toggle
        if (this.btnFullscreen) {
            this.btnFullscreen.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Layers Popover
        if (this.btnLayers) {
            this.btnLayers.addEventListener('click', () => {
                this.closeAllPopovers();
                this.popoverLayers.classList.toggle('hidden');
                if (!this.popoverLayers.classList.contains('hidden')) {
                    this.renderLayers();
                }
            });
        }

        if (this.btnCloseLayers) {
            this.btnCloseLayers.addEventListener('click', () => {
                this.popoverLayers.classList.add('hidden');
            });
        }

        // Comments Popover
        if (this.btnComments) {
            this.btnComments.addEventListener('click', () => {
                this.closeAllPopovers();
                this.popoverComments.classList.toggle('hidden');
            });
        }

        if (this.btnCloseComments) {
            this.btnCloseComments.addEventListener('click', () => {
                this.popoverComments.classList.add('hidden');
            });
        }

        // Close popovers when clicking outside
        document.addEventListener('click', (e) => {
            if (this.btnLayers && this.popoverLayers && 
                !this.btnLayers.contains(e.target) && !this.popoverLayers.contains(e.target)) {
                this.popoverLayers.classList.add('hidden');
            }
            if (this.btnComments && this.popoverComments && 
                !this.btnComments.contains(e.target) && !this.popoverComments.contains(e.target)) {
                this.popoverComments.classList.add('hidden');
            }
        });

        // Update layers if open
        this.eventBus.on('CANVAS:DIRTY', () => {
            if (this.popoverLayers && !this.popoverLayers.classList.contains('hidden')) {
                this.renderLayers();
            }
        });
    }

    closeAllPopovers() {
        if (this.popoverLayers) this.popoverLayers.classList.add('hidden');
        if (this.popoverComments) this.popoverComments.classList.add('hidden');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    renderLayers() {
        if (!this.layersList || !this.canvasEngine) return;
        
        this.layersList.innerHTML = '';
        
        const objects = this.canvasEngine.canvas.getObjects();
        if (objects.length === 0) {
            this.layersList.innerHTML = '<div class="text-xs text-slate-400 p-2 text-center">目前沒有圖層</div>';
            return;
        }

        // Render from top to bottom (reverse array)
        [...objects].reverse().forEach((obj, index) => {
            const layerName = obj.layerName || obj.type;
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-xs shadow-sm cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors';
            
            // Icon based on type
            let iconClass = 'fa-square';
            if (obj.type === 'i-text' || obj.type === 'text') iconClass = 'fa-font';
            if (obj.type === 'image') iconClass = 'fa-image';
            if (obj.type === 'path') iconClass = 'fa-pen';
            if (obj.layerName && obj.layerName.includes('背景')) iconClass = 'fa-chess-board';

            item.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden">
                    <i class="fas ${iconClass} text-slate-400"></i>
                    <span class="truncate text-slate-700 font-medium">${layerName}</span>
                </div>
                <div class="flex items-center gap-1">
                    <button class="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="切換顯示">
                        <i class="fas ${obj.visible !== false ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </button>
                </div>
            `;

            // Click to select
            item.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // Ignore if clicked on eye
                this.canvasEngine.canvas.setActiveObject(obj);
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('OBJECT:SELECTED', obj);
            });

            // Toggle visibility
            const eyeBtn = item.querySelector('button');
            eyeBtn.addEventListener('click', () => {
                obj.set('visible', obj.visible === false ? true : false);
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY');
            });

            this.layersList.appendChild(item);
        });
    }
}
