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
                bgPreview: 'bg-slate-900 border-slate-700 text-white',
                colors: ['#0f172a', '#1e293b', '#6366f1', '#38bdf8']
            },
            {
                id: 'light',
                name: '經典手繪 (Light Sketch)',
                tag: '預設',
                desc: '溫暖手繪雙線邊框、高對比手繪插畫風格',
                icon: 'fa-sun',
                bgPreview: 'bg-white border-slate-700 text-slate-800',
                colors: ['#ffffff', '#f8fafc', '#334155', '#4f46e5']
            },
            {
                id: 'pro-slate',
                name: '專業冷灰 (Pro Slate)',
                tag: '效率',
                desc: '冷灰現代極簡介面，專注於畫布創作與設計',
                icon: 'fa-laptop-code',
                bgPreview: 'bg-slate-800 border-slate-600 text-slate-100',
                colors: ['#0f172a', '#1e293b', '#38bdf8', '#64748b']
            },
            {
                id: 'retro-warm',
                name: '復古文青 (Retro Warm)',
                tag: '典雅',
                desc: '羊皮紙暖調與莫蘭迪大地色系，柔和手感',
                icon: 'fa-feather-alt',
                bgPreview: 'bg-[#fdfbf7] border-[#5c4738] text-[#423223]',
                colors: ['#fdfbf7', '#f5eedc', '#d97706', '#5c4738']
            }
        ];

        this.init();
    }

    init() {
        // 套用儲存的主題
        this.applyTheme(this.currentTheme, false);

        // 建立設定與主題彈窗 DOM
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
        modal.className = 'fixed inset-0 z-[9990] bg-slate-900/70 backdrop-blur-sm hidden flex items-center justify-center p-4 select-none opacity-0 transition-opacity duration-200';

        modal.innerHTML = `
            <div class="settings-modal-card sketch-panel bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border-2 border-slate-700 animate-in fade-in zoom-in duration-200">
                <!-- Modal Header -->
                <div class="px-6 py-4 border-b-2 border-slate-700 flex items-center justify-between bg-slate-50">
                    <div class="flex items-center space-x-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md text-base">
                            <i class="fas fa-sliders-h"></i>
                        </div>
                        <div>
                            <h2 class="text-lg font-black text-slate-800">系統與外觀設定</h2>
                            <p class="text-xs text-slate-500">自訂編輯器風格、操作偏好與畫布輔助工具</p>
                        </div>
                    </div>
                    <button id="btn-close-settings-modal" class="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition">
                        <i class="fas fa-times text-base"></i>
                    </button>
                </div>

                <!-- Modal Body with Tabs -->
                <div class="flex flex-1 overflow-hidden">
                    <!-- Left Tab Nav -->
                    <div class="w-44 bg-slate-100/70 border-r-2 border-slate-700 p-3 space-y-1.5 shrink-0">
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

                    <!-- Right Tab Panels -->
                    <div class="flex-1 p-6 overflow-y-auto bg-white" id="settings-tab-content">
                        <!-- Tab 1: 主題切換 -->
                        <div id="settings-panel-theme" class="space-y-4">
                            <div class="flex items-center justify-between mb-2">
                                <h3 class="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                    <i class="fas fa-brush text-indigo-500"></i> 介面視覺主題 (Sprint 2)
                                </h3>
                                <span class="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold border border-indigo-200">即時切換套用</span>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="theme-options-grid">
                                ${this.renderThemeCardsHTML()}
                            </div>
                        </div>

                        <!-- Tab 2: 畫布輔助 -->
                        <div id="settings-panel-canvas" class="hidden space-y-4">
                            <h3 class="text-sm font-black text-slate-800 flex items-center gap-1.5 mb-2">
                                <i class="fas fa-magic text-indigo-500"></i> 編輯器輔助功能
                            </h3>
                            <div class="space-y-3">
                                <label class="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                                    <div>
                                        <div class="text-xs font-bold text-slate-800">自動吸附與智慧參考線</div>
                                        <div class="text-[11px] text-slate-400">物件移動時自動對齊畫布邊緣與其他圖元中心</div>
                                    </div>
                                    <input type="checkbox" id="setting-smart-guides" checked class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                                </label>
                                <label class="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                                    <div>
                                        <div class="text-xs font-bold text-slate-800">高解析背景預渲染</div>
                                        <div class="text-[11px] text-slate-400">PDF/PPT 匯入時自動產生 Retina 2x 高解析背景</div>
                                    </div>
                                    <input type="checkbox" id="setting-retina-render" checked class="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500">
                                </label>
                            </div>
                        </div>

                        <!-- Tab 3: 關於系統 -->
                        <div id="settings-panel-about" class="hidden space-y-4">
                            <div class="text-center py-4">
                                <div class="w-14 h-14 mx-auto bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg mb-3">
                                    <i class="fas fa-cubes"></i>
                                </div>
                                <h3 class="text-base font-black text-slate-800">多媒體畫布編輯器 V2</h3>
                                <p class="text-xs text-slate-500 mt-1 font-mono">系統版本: v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.2'}</p>
                            </div>
                            <div class="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2 text-slate-600">
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

                <!-- Modal Footer -->
                <div class="px-6 py-3 border-t-2 border-slate-700 bg-slate-50 flex items-center justify-between">
                    <div class="text-[11px] text-slate-400 font-medium">
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
                <div class="theme-card-option sketch-panel p-3.5 rounded-xl cursor-pointer border-2 transition relative flex flex-col justify-between ${t.bgPreview} ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-600 shadow-md' : 'hover:border-indigo-400 hover:shadow-sm'}" data-theme-id="${t.id}">
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <div class="flex items-center space-x-2">
                                <i class="fas ${t.icon} text-sm"></i>
                                <span class="font-bold text-xs">${t.name}</span>
                            </div>
                            <span class="text-[9px] px-1.5 py-0.5 rounded font-bold ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}">${isSelected ? '使用中' : t.tag}</span>
                        </div>
                        <p class="text-[11px] opacity-75 mb-3">${t.desc}</p>
                    </div>

                    <!-- 調色盤預覽圓點 -->
                    <div class="flex items-center justify-between pt-2 border-t border-current/10">
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
            const badge = card.querySelector('span.text-\\[9px\\]');
            
            if (isSelected) {
                card.classList.add('ring-2', 'ring-indigo-500', 'border-indigo-600', 'shadow-md');
                if (check) check.classList.remove('hidden');
                if (badge) {
                    badge.textContent = '使用中';
                    badge.className = 'text-[9px] px-1.5 py-0.5 rounded font-bold bg-indigo-600 text-white';
                }
            } else {
                card.classList.remove('ring-2', 'ring-indigo-500', 'border-indigo-600', 'shadow-md');
                if (check) check.classList.add('hidden');
                const themeData = this.themes.find(t => t.id === card.dataset.themeId);
                if (badge && themeData) {
                    badge.textContent = themeData.tag;
                    badge.className = 'text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-200 text-slate-700';
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
                btn.className = 'settings-tab-btn active w-full px-3 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2.5 transition text-left bg-indigo-50 text-indigo-700 border border-indigo-200';
            } else {
                btn.className = 'settings-tab-btn w-full px-3 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2.5 transition text-left text-slate-600 hover:bg-slate-200/60';
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
