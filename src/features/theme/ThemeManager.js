/**
 * ThemeManager.js - 顏色模板與主題切換系統 (Sprint 2)
 * 支援：經典手繪 (Light Sketch)、深色極客 (Dark Geek)、專業冷灰 (Pro Slate)、復古文青 (Retro Warm)
 */
export default class ThemeManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentTheme = localStorage.getItem('editor_theme') || 'light';
        this.themes = [
            {
                id: 'dark',
                name: '深色極客 (Dark Mode)',
                tag: '推薦',
                desc: '黑曜藍深色背景，夜間護眼，科技感與清晰對比',
                icon: 'fa-moon',
                cardClass: 'theme-preview-dark',
                colors: ['#0f172a', '#1e293b', '#6366f1', '#38bdf8']
            },
            {
                id: 'light',
                name: '經典手繪 (Light Sketch)',
                tag: '預設',
                desc: '溫暖手繪雙線邊框、高對比手繪插畫風格',
                icon: 'fa-sun',
                cardClass: 'theme-preview-light',
                colors: ['#ffffff', '#f8fafc', '#334155', '#4f46e5']
            },
            {
                id: 'pro-slate',
                name: '專業冷灰 (Pro Slate)',
                tag: '效率',
                desc: '工業鈦金冷灰調，幾何精密無手繪感，專業工作站質感',
                icon: 'fa-cube',
                cardClass: 'theme-preview-pro',
                colors: ['#181c24', '#222733', '#06b6d4', '#4b5563']
            },
            {
                id: 'retro-warm',
                name: '復古文青 (Retro Warm)',
                tag: '典雅',
                desc: '羊皮紙暖調與莫蘭迪大地色系，柔和手感',
                icon: 'fa-feather-alt',
                cardClass: 'theme-preview-retro',
                colors: ['#fdfbf7', '#f5eedc', '#d97706', '#5c4738']
            }
        ];

        this.init();
    }

    init() {
        // 套用儲存的主題
        this.applyTheme(this.currentTheme, false);

        // 建立設定與主題彈窗 DOM (固定尺寸，支援滾動)
        this.createSettingsModalDOM();

        // 綁定事件
        this.bindEvents();
    }

    bindEvents() {
        // 專案內設定按鈕
        const btnEditorSettings = document.getElementById('btn-editor-settings');
        if (btnEditorSettings) {
            btnEditorSettings.addEventListener('click', () => this.openModal('theme'));
        }

        // 專案儀表板設定按鈕 (動態委派監聽)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#btn-dashboard-settings');
            if (btn) {
                this.openModal('theme');
            }
        });

        // 監聽全域事件
        this.eventBus.on('SETTINGS:OPEN', (data) => {
            this.openModal(data?.tab || 'theme');
        });

        this.eventBus.on('THEME:SET', ({ themeId }) => {
            this.applyTheme(themeId);
        });
    }

    applyTheme(themeId, emitEvent = true) {
        this.currentTheme = themeId;
        localStorage.setItem('editor_theme', themeId);

        // 設定 html 與 body 的 data-theme 與 class
        document.documentElement.setAttribute('data-theme', themeId);
        document.body.setAttribute('data-theme', themeId);

        // 移除舊的 theme-* class 並加入新的
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-pro-slate', 'theme-retro-warm');
        document.body.classList.add(`theme-${themeId}`);

        // 更新彈窗內的選中狀態
        this.updateModalSelection();

        if (emitEvent) {
            this.eventBus.emit('THEME:CHANGED', { themeId });
        }
    }

    createSettingsModalDOM() {
        let modal = document.getElementById('settings-modal-overlay');
        if (modal) return;

        modal = document.createElement('div');
        modal.id = 'settings-modal-overlay';
        modal.className = 'fixed inset-0 z-[9990] bg-slate-900/75 backdrop-blur-sm hidden flex items-center justify-center p-4 select-none opacity-0 transition-opacity duration-200';

        modal.innerHTML = `
            <!-- 固定邊框大小卡片：寬 720px、高 520px，內容過多自動上下滾動，內容過少也不會縮小 -->
            <div class="settings-modal-card sketch-panel w-[720px] h-[520px] max-w-[94vw] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border-2 border-slate-700 animate-in fade-in zoom-in duration-200">
                <!-- Modal Header (固定高度 64px) -->
                <div class="settings-modal-header h-16 px-6 border-b-2 border-slate-700 flex items-center justify-between shrink-0 bg-slate-50">
                    <div class="flex items-center space-x-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md text-base shrink-0">
                            <i class="fas fa-sliders-h"></i>
                        </div>
                        <div>
                            <h2 class="text-base font-black text-slate-800 modal-header-title">系統與外觀設定</h2>
                            <p class="text-xs text-slate-500 modal-header-subtitle">自訂編輯器風格、操作偏好與畫布輔助工具</p>
                        </div>
                    </div>
                    <button id="btn-close-settings-modal" class="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition">
                        <i class="fas fa-times text-base"></i>
                    </button>
                </div>

                <!-- Modal Body with Tabs (固定填滿中間高度，可內部滾動) -->
                <div class="settings-modal-body flex flex-1 overflow-hidden min-h-0">
                    <!-- Left Tab Nav (固定寬度 180px) -->
                    <div class="settings-modal-sidebar w-48 border-r-2 border-slate-700 p-3 space-y-1.5 shrink-0 bg-slate-100/70 overflow-y-auto">
                        <button data-settings-tab="theme" class="settings-tab-btn active w-full px-3 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2.5 transition text-left">
                            <i class="fas fa-palette text-sm w-4 text-center"></i>
                            <span>主題與風格</span>
                        </button>
                        <button data-settings-tab="canvas" class="settings-tab-btn w-full px-3 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2.5 transition text-left text-slate-600 hover:bg-slate-200/60">
                            <i class="fas fa-ruler-combined text-sm w-4 text-center"></i>
                            <span>畫布輔助</span>
                        </button>
                        <button data-settings-tab="about" class="settings-tab-btn w-full px-3 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2.5 transition text-left text-slate-600 hover:bg-slate-200/60">
                            <i class="fas fa-info-circle text-sm w-4 text-center"></i>
                            <span>關於系統</span>
                        </button>
                    </div>

                    <!-- Right Tab Panels (可獨立垂直滾動) -->
                    <div class="settings-modal-content flex-1 p-6 overflow-y-auto bg-white min-h-0" id="settings-tab-content">
                        <!-- Tab 1: 主題切換 -->
                        <div id="settings-panel-theme" class="space-y-4">
                            <div class="flex items-center justify-between mb-1">
                                <h3 class="text-sm font-black text-slate-800 flex items-center gap-1.5 panel-section-title">
                                    <i class="fas fa-brush text-indigo-500"></i> 介面視覺主題 (Sprint 2)
                                </h3>
                                <span class="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold border border-indigo-200 badge-info">即時切換套用</span>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5" id="theme-options-grid">
                                ${this.renderThemeCardsHTML()}
                            </div>
                        </div>

                        <!-- Tab 2: 畫布輔助 -->
                        <div id="settings-panel-canvas" class="hidden space-y-4">
                            <h3 class="text-sm font-black text-slate-800 flex items-center gap-1.5 mb-2 panel-section-title">
                                <i class="fas fa-magic text-indigo-500"></i> 編輯器輔助功能
                            </h3>
                            <div class="space-y-3">
                                <label class="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50/50 cursor-pointer transition setting-card-item">
                                    <div>
                                        <div class="text-xs font-bold text-slate-800 setting-item-title">自動吸附與智慧參考線</div>
                                        <div class="text-[11px] text-slate-400 mt-0.5 setting-item-desc">物件移動時自動對齊畫布邊緣與其他圖元中心</div>
                                    </div>
                                    <input type="checkbox" id="setting-smart-guides" checked class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                                </label>
                                <label class="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50/50 cursor-pointer transition setting-card-item">
                                    <div>
                                        <div class="text-xs font-bold text-slate-800 setting-item-title">高解析背景預渲染</div>
                                        <div class="text-[11px] text-slate-400 mt-0.5 setting-item-desc">PDF/PPT 匯入時自動產生 Retina 2x 高解析背景</div>
                                    </div>
                                    <input type="checkbox" id="setting-retina-render" checked class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                                </label>
                            </div>
                        </div>

                        <!-- Tab 3: 關於系統 -->
                        <div id="settings-panel-about" class="hidden space-y-4">
                            <div class="text-center py-2">
                                <div class="w-12 h-12 mx-auto bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg mb-2">
                                    <i class="fas fa-cubes"></i>
                                </div>
                                <h3 class="text-sm font-black text-slate-800 modal-about-title">多媒體畫布編輯器 V2</h3>
                                <p class="text-xs text-slate-500 mt-0.5 font-mono modal-about-version">系統版本: v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.0'}</p>
                            </div>
                            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2 text-slate-600 modal-about-box">
                                <div class="flex justify-between">
                                    <span class="font-bold">目前架構：</span>
                                    <span>Sprint 2 (顏色模板與主題切換)</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="font-bold">資料儲存庫：</span>
                                    <span>瀏覽器原生 IndexedDB (免聯網永久存檔)</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="font-bold">畫布核心：</span>
                                    <span>Fabric.js + PDF.js + ONNX AI 去背引擎</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer (固定高度 56px) -->
                <div class="settings-modal-footer h-14 px-6 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between shrink-0">
                    <div class="text-[11px] text-slate-400 font-medium modal-footer-tip">
                        <i class="fas fa-info-circle mr-1"></i> 主題切換已自動記憶於您的瀏覽器
                    </div>
                    <button id="btn-save-settings-modal" class="sketch-btn px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md">
                        完成設定
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 綁定關閉與分頁按鈕
        const closeBtn = modal.querySelector('#btn-close-settings-modal');
        const saveBtn = modal.querySelector('#btn-save-settings-modal');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (saveBtn) saveBtn.addEventListener('click', () => this.closeModal());

        // 點擊背景關閉
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // 分頁切換
        const tabBtns = modal.querySelectorAll('.settings-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.settingsTab;
                this.switchTab(target);
            });
        });

        // 主題卡片點擊切換
        this.bindThemeCardEvents();
    }

    bindThemeCardEvents() {
        const modal = document.getElementById('settings-modal-overlay');
        if (!modal) return;

        const themeCards = modal.querySelectorAll('.theme-card-option');
        themeCards.forEach(card => {
            card.addEventListener('click', () => {
                const themeId = card.dataset.themeId;
                this.applyTheme(themeId);
            });
        });
    }

    renderThemeCardsHTML() {
        return this.themes.map(t => {
            const isSelected = t.id === this.currentTheme;
            return `
                <div class="theme-card-option ${t.cardClass} sketch-panel p-3.5 rounded-xl cursor-pointer border-2 transition relative flex flex-col justify-between ${isSelected ? 'is-active ring-2 ring-indigo-500 border-indigo-600 shadow-md' : 'hover:border-indigo-400 hover:shadow-sm'}" data-theme-id="${t.id}">
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center space-x-2">
                                <i class="fas ${t.icon} text-sm"></i>
                                <span class="font-bold text-xs theme-card-title">${t.name}</span>
                            </div>
                            <span class="theme-card-tag text-[9px] px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200/80 text-slate-700'}">${isSelected ? '使用中' : t.tag}</span>
                        </div>
                        <p class="text-[11px] theme-card-desc mb-3 leading-relaxed">${t.desc}</p>
                    </div>

                    <!-- 調色盤預覽圓點 -->
                    <div class="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10">
                        <div class="flex items-center space-x-1.5">
                            ${t.colors.map(c => `<span class="w-3.5 h-3.5 rounded-full border border-black/20" style="background-color: ${c};"></span>`).join('')}
                        </div>
                        <i class="fas fa-check-circle text-indigo-500 text-sm ${isSelected ? '' : 'hidden'} theme-active-check"></i>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateModalSelection() {
        const modal = document.getElementById('settings-modal-overlay');
        if (!modal) return;

        const cards = modal.querySelectorAll('.theme-card-option');
        cards.forEach(card => {
            const isSelected = card.dataset.themeId === this.currentTheme;
            const check = card.querySelector('.theme-active-check');
            const badge = card.querySelector('.theme-card-tag');
            
            if (isSelected) {
                card.classList.add('is-active', 'ring-2', 'ring-indigo-500', 'border-indigo-600', 'shadow-md');
                if (check) check.classList.remove('hidden');
                if (badge) {
                    badge.textContent = '使用中';
                    badge.className = 'theme-card-tag text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-600 text-white';
                }
            } else {
                card.classList.remove('is-active', 'ring-2', 'ring-indigo-500', 'border-indigo-600', 'shadow-md');
                if (check) check.classList.add('hidden');
                const themeData = this.themes.find(t => t.id === card.dataset.themeId);
                if (badge && themeData) {
                    badge.textContent = themeData.tag;
                    badge.className = 'theme-card-tag text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-200/80 text-slate-700';
                }
            }
        });
    }

    switchTab(tabName) {
        const modal = document.getElementById('settings-modal-overlay');
        if (!modal) return;

        // 更新按鈕樣式
        modal.querySelectorAll('.settings-tab-btn').forEach(btn => {
            if (btn.dataset.settingsTab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 切換面板
        const panels = ['theme', 'canvas', 'about'];
        panels.forEach(p => {
            const panelEl = modal.querySelector(`#settings-panel-${p}`);
            if (panelEl) {
                if (p === tabName) {
                    panelEl.classList.remove('hidden');
                } else {
                    panelEl.classList.add('hidden');
                }
            }
        });
    }

    openModal(tab = 'theme') {
        const modal = document.getElementById('settings-modal-overlay');
        if (!modal) return;

        this.switchTab(tab);
        this.updateModalSelection();

        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
        }, 10);
    }

    closeModal() {
        const modal = document.getElementById('settings-modal-overlay');
        if (!modal) return;

        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    }
}
