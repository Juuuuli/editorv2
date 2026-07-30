import AssetsManager from './AssetsManager.js';

export default class AssetsPanel {
    constructor(canvasEngine, eventBus) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;
        this.container = document.getElementById('panel-assets');
        
        this.assetsManager = new AssetsManager();
        this.init();
    }

    async init() {
        await this.assetsManager.init();
        this.renderUI();
        this.bindEvents();
        this.loadAssets();
    }

    renderUI() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="mb-4">
                <button id="btn-upload-asset" class="w-full sketch-btn py-2.5 px-4 text-sm font-bold flex items-center justify-center gap-2 text-indigo-700 bg-indigo-50 border-indigo-700">
                    <i class="fas fa-cloud-upload-alt"></i> 上傳本機圖片
                </button>
                <input type="file" id="input-upload-asset" class="hidden" accept="image/*">
            </div>
            <div id="assets-grid" class="grid grid-cols-2 gap-2">
                <!-- 動態生成素材清單 -->
            </div>
            <div id="assets-empty" class="text-sm text-slate-500 text-center py-10 hidden">
                尚未上傳任何素材
            </div>
        `;
    }

    bindEvents() {
        const btnUpload = document.getElementById('btn-upload-asset');
        const inputUpload = document.getElementById('input-upload-asset');

        if (btnUpload && inputUpload) {
            btnUpload.addEventListener('click', () => {
                inputUpload.click();
            });

            inputUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        const dataUrl = event.target.result;
                        await this.assetsManager.saveAsset(dataUrl);
                        this.loadAssets();
                    };
                    reader.readAsDataURL(file);
                }
                // 清空 input，允許重複上傳相同檔案
                e.target.value = '';
            });
        }

        // 監聽素材點擊加入畫布
        const grid = document.getElementById('assets-grid');
        if (grid) {
            grid.addEventListener('click', (e) => {
                const btnAdd = e.target.closest('.asset-add-btn');
                if (btnAdd) {
                    const item = btnAdd.closest('.asset-item');
                    const dataUrl = item.dataset.url;
                    this.addAssetToCanvas(dataUrl);
                    return;
                }
                
                const btnDel = e.target.closest('.asset-del-btn');
                if (btnDel) {
                    const item = btnDel.closest('.asset-item');
                    const id = item.dataset.id;
                    this.assetsManager.deleteAsset(id).then(() => this.loadAssets());
                    return;
                }
            });
        }

        // 監聽儲存至素材庫的廣播 (提供給外部像是儲存 QR Code 時使用)
        this.eventBus.on('ASSETS:SAVE', async (dataUrl) => {
            await this.assetsManager.saveAsset(dataUrl);
            this.loadAssets();
            // 自動切換到素材庫面板展示成果
            this.eventBus.emit('UI:SWITCH_PANEL', { tabId: 'tab-assets', panelId: 'panel-assets' });
        });
    }

    async loadAssets() {
        const assets = await this.assetsManager.getAllAssets();
        const grid = document.getElementById('assets-grid');
        const emptyState = document.getElementById('assets-empty');
        
        if (!grid || !emptyState) return;

        if (assets.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            grid.innerHTML = assets.map(asset => `
                <div class="asset-item relative sketch p-1 group cursor-pointer" data-id="${asset.id}" data-url="${asset.dataUrl}">
                    <img src="${asset.dataUrl}" class="w-full h-24 object-contain rounded bg-slate-50 pointer-events-none">
                    
                    <!-- 懸停操作遮罩 -->
                    <div class="absolute inset-0 bg-slate-800/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 rounded">
                        <button class="asset-add-btn w-8 h-8 rounded-full bg-white text-indigo-600 flex justify-center items-center hover:scale-110 transition shadow" title="加入畫布">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
                        <button class="asset-del-btn w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex justify-center items-center hover:scale-110 transition shadow" title="刪除">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    }

    addAssetToCanvas(dataUrl) {
        fabric.Image.fromURL(dataUrl, (img) => {
            const artboard = this.canvasEngine.artboard;
            // 縮放並置中
            const maxSize = 200;
            if (img.width > maxSize || img.height > maxSize) {
                const scale = Math.min(maxSize / img.width, maxSize / img.height);
                img.scale(scale);
            }
            img.set({
                left: artboard.left + artboard.width / 2,
                top: artboard.top + artboard.height / 2,
                originX: 'center',
                originY: 'center'
            });
            this.canvasEngine.addObject(img);
            this.eventBus.emit('UI:SWITCH_PANEL', { tabId: 'tab-properties', panelId: 'panel-properties' });
        });
    }
}
