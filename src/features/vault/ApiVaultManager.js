/**
 * 系統模型設定與金鑰保險箱管理器 (ApiVaultManager)
 * 負責提供 AI 核心模型、影像處理與簡報轉檔之多分頁設定彈窗與 LocalStorage 集中管理
 */
export default class ApiVaultManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.storageKey = 'EDITOR_V2_VAULT_CONFIG';
        this.legacyStorageKey = 'editor_api_vault';
        
        // 預設配置
        this.config = this.loadConfig();
        this.activeTab = 'llm'; // 'llm' | 'image' | 'ppt'
        this.activeLlmSubTab = this.config.activeLlmType || 'builtin'; // 'builtin' | 'custom'

        this.initDOM();
        this.bindEvents();
    }

    /**
     * 讀取儲存庫設定 (含向下相容)
     */
    loadConfig() {
        const defaultConfig = {
            activeLlmType: 'builtin',
            builtin: {
                provider: 'openai',
                model: 'gpt-4o',
                apiKey: ''
            },
            custom: {
                name: '',
                baseUrl: '',
                modelId: '',
                token: ''
            },
            imageProcessing: {
                provider: 'clipdrop',
                apiKey: ''
            },
            pptParsing: {
                provider: 'convertapi',
                secret: ''
            },
            updatedAt: Date.now()
        };

        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                return { ...defaultConfig, ...JSON.parse(raw) };
            }

            // 檢查舊版 editor_api_vault
            const legacyRaw = localStorage.getItem(this.legacyStorageKey);
            if (legacyRaw) {
                const legacy = JSON.parse(legacyRaw);
                if (legacy.openaiApiKey) defaultConfig.builtin.apiKey = legacy.openaiApiKey;
                if (legacy.clipdropKey) defaultConfig.imageProcessing.apiKey = legacy.clipdropKey;
                if (legacy.convertApiKey) defaultConfig.pptParsing.secret = legacy.convertApiKey;
            }

            // 檢查更舊版獨立 key
            if (!defaultConfig.builtin.apiKey && localStorage.getItem('openai_api_key')) {
                defaultConfig.builtin.apiKey = localStorage.getItem('openai_api_key');
            }
            if (!defaultConfig.imageProcessing.apiKey && localStorage.getItem('clipdrop_api_key')) {
                defaultConfig.imageProcessing.apiKey = localStorage.getItem('clipdrop_api_key');
            }
            if (!defaultConfig.pptParsing.secret && localStorage.getItem('convertapi_secret')) {
                defaultConfig.pptParsing.secret = localStorage.getItem('convertapi_secret');
            }

            return defaultConfig;
        } catch (e) {
            console.warn('[ApiVaultManager] 讀取配置失敗，使用預設值', e);
            return defaultConfig;
        }
    }

    /**
     * 儲存設定並同步相容舊版格式與發送事件
     */
    saveConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig,
            updatedAt: Date.now()
        };

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.config));

            // 同步寫入舊版格式，確保 SmartTools, ClipdropAPI, FileImportManager 完全相容
            const legacyData = {
                openaiApiKey: this.config.builtin.apiKey || '',
                clipdropKey: this.config.imageProcessing.apiKey || '',
                convertApiKey: this.config.pptParsing.secret || '',
                updatedAt: Date.now()
            };
            localStorage.setItem(this.legacyStorageKey, JSON.stringify(legacyData));
            localStorage.setItem('editorv2_api_vault', JSON.stringify(legacyData));

            if (this.config.builtin.apiKey) localStorage.setItem('openai_api_key', this.config.builtin.apiKey);
            if (this.config.imageProcessing.apiKey) localStorage.setItem('clipdrop_api_key', this.config.imageProcessing.apiKey);
            if (this.config.pptParsing.secret) localStorage.setItem('convertapi_secret', this.config.pptParsing.secret);

            if (this.eventBus) {
                this.eventBus.emit('VAULT:CONFIG_UPDATED', this.config);
                this.eventBus.emit('API_VAULT:UPDATED', legacyData);
            }

            this.showToast('✅ 金鑰與模型設定已成功儲存！');
            this.close();
        } catch (e) {
            console.error('[ApiVaultManager] 儲存失敗', e);
            this.showToast('❌ 儲存失敗，請檢查儲存空間', 'error');
        }
    }

    /**
     * 建立 DOM 元件
     */
    initDOM() {
        const existing = document.getElementById('api-vault-modal');
        if (existing) existing.remove();

        this.modal = document.createElement('div');
        this.modal.id = 'api-vault-modal';
        this.modal.className = 'fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300 opacity-0 pointer-events-none select-none';

        this.modal.innerHTML = `
            <div id="api-vault-card" class="w-[780px] h-[560px] max-w-[95vw] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                <!-- Header (64px) -->
                <div id="api-vault-header" class="h-16 px-6 shrink-0 flex items-center justify-between border-b">
                    <div class="flex items-center gap-3">
                        <div id="api-vault-logo-box" class="w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 id="api-vault-title" class="text-base font-black tracking-wide">系統模型設定與金鑰保險箱</h3>
                                <span class="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">API Vault</span>
                            </div>
                            <p id="api-vault-subtitle" class="text-xs">集中控管 AI 核心大腦、影像處理與轉檔服務金鑰</p>
                        </div>
                    </div>
                    <button id="btn-close-api-vault" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>

                <!-- Main Body (Sidebar + Content) -->
                <div class="flex-1 flex overflow-hidden min-h-0">
                    <!-- Left Sidebar (200px) -->
                    <div id="vault-sidebar" class="w-48 md:w-52 shrink-0 border-r flex flex-col py-3 space-y-1">
                        <button id="vault-tab-btn-llm" class="vault-sidebar-btn text-left px-4 py-3 text-xs font-bold transition flex items-center justify-between">
                            <div class="flex items-center gap-2.5">
                                <i class="fas fa-brain w-4 text-center"></i>
                                <span>AI 核心模型</span>
                            </div>
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </button>
                        <button id="vault-tab-btn-image" class="vault-sidebar-btn text-left px-4 py-3 text-xs font-bold transition flex items-center justify-between">
                            <div class="flex items-center gap-2.5">
                                <i class="fas fa-image w-4 text-center"></i>
                                <span>影像去背與修補</span>
                            </div>
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </button>
                        <button id="vault-tab-btn-ppt" class="vault-sidebar-btn text-left px-4 py-3 text-xs font-bold transition flex items-center justify-between">
                            <div class="flex items-center gap-2.5">
                                <i class="fas fa-file-powerpoint w-4 text-center"></i>
                                <span>簡報轉檔解析</span>
                            </div>
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                        </button>
                        
                        <div class="mt-auto px-4 py-3 text-[11px] opacity-60 flex items-center gap-1.5 border-t">
                            <i class="fas fa-lock text-[10px]"></i> 本地端加密儲存
                        </div>
                    </div>

                    <!-- Right Content (Scrollable) -->
                    <div id="vault-content-area" class="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5">
                        
                        <!-- TAB 1: AI 核心模型 -->
                        <div id="vault-view-llm" class="space-y-4">
                            <div>
                                <h4 class="text-sm font-black flex items-center gap-2">
                                    <i class="fas fa-brain text-indigo-400"></i> AI 核心模型 (LLM 大腦)
                                </h4>
                                <p class="text-xs opacity-75 mt-0.5">負責畫布上的智慧文案生成、版面分析與視覺 OCR 辨識。</p>
                            </div>

                            <!-- LLM 子分頁切換 -->
                            <div class="flex border-b gap-4 text-xs font-bold">
                                <button id="vault-subtab-builtin" class="vault-subtab-btn pb-2 transition flex items-center gap-1.5">
                                    <i class="fas fa-cube"></i> 內建主流模型 (推薦)
                                </button>
                                <button id="vault-subtab-custom" class="vault-subtab-btn pb-2 transition flex items-center gap-1.5">
                                    <i class="fas fa-server"></i> 自訂端點 (vLLM / Ollama)
                                </button>
                            </div>

                            <!-- 內建主流模型內容 -->
                            <div id="vault-subcontent-builtin" class="space-y-4">
                                <div class="vault-section-card p-4 rounded-xl space-y-3">
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="space-y-1">
                                            <label class="text-[11px] font-bold">服務提供商</label>
                                            <select id="vault-builtin-provider" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs">
                                                <option value="openai">OpenAI (推薦)</option>
                                                <option value="anthropic">Anthropic (Claude)</option>
                                            </select>
                                        </div>
                                        <div class="space-y-1">
                                            <label class="text-[11px] font-bold">模型選擇</label>
                                            <select id="vault-builtin-model" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs">
                                                <option value="gpt-4o">GPT-4o (全能視覺旗艦)</option>
                                                <option value="gpt-4o-mini">GPT-4o-mini (輕量極速)</option>
                                                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[11px] font-bold flex items-center justify-between">
                                            <span>API Key 金鑰</span>
                                            <span class="text-[10px] opacity-60">sk-...</span>
                                        </label>
                                        <div class="relative flex items-center">
                                            <input type="password" id="vault-builtin-key" placeholder="填入 API Key" class="vault-input-field w-full rounded-lg px-3 py-2 pr-10 text-xs font-mono">
                                            <button type="button" class="vault-toggle-pwd absolute right-3 text-xs opacity-60 hover:opacity-100">
                                                <i class="fas fa-eye"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- 自訂模型端點內容 -->
                            <div id="vault-subcontent-custom" class="space-y-4 hidden">
                                <div class="vault-section-card p-4 rounded-xl space-y-3">
                                    <div class="space-y-1">
                                        <label class="text-[11px] font-bold">配置名稱</label>
                                        <input type="text" id="vault-custom-name" placeholder="例如：公司內網 vLLM 伺服器" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs">
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[11px] font-bold">Base URL (OpenAI 相容端點)</label>
                                        <input type="text" id="vault-custom-url" placeholder="https://api.your-company.com/v1" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs font-mono">
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="space-y-1">
                                            <label class="text-[11px] font-bold">模型識別碼 (Model ID)</label>
                                            <input type="text" id="vault-custom-model" placeholder="meta-llama/Llama-3-8B" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs font-mono">
                                        </div>
                                        <div class="space-y-1">
                                            <label class="text-[11px] font-bold">Bearer Token / Key (選填)</label>
                                            <div class="relative flex items-center">
                                                <input type="password" id="vault-custom-token" placeholder="Optional" class="vault-input-field w-full rounded-lg px-3 py-2 pr-10 text-xs font-mono">
                                                <button type="button" class="vault-toggle-pwd absolute right-3 text-xs opacity-60 hover:opacity-100">
                                                    <i class="fas fa-eye"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 2: 影像處理服務 -->
                        <div id="vault-view-image" class="space-y-4 hidden">
                            <div>
                                <h4 class="text-sm font-black flex items-center gap-2">
                                    <i class="fas fa-image text-pink-400"></i> 影像去背與修補 (Image Processing)
                                </h4>
                                <p class="text-xs opacity-75 mt-0.5">用於智慧去背、AI 抹除修補 (Inpainting) 與物件消除。</p>
                            </div>

                            <div class="vault-section-card p-4 rounded-xl space-y-3">
                                <div class="space-y-1">
                                    <label class="text-[11px] font-bold">服務提供商</label>
                                    <select id="vault-image-provider" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs">
                                        <option value="clipdrop">Clipdrop API (預設 · 支援去背與修補)</option>
                                        <option value="photoroom">Photoroom API (電商高品質去背)</option>
                                        <option value="removebg">Remove.bg (純去背服務)</option>
                                        <option value="sd">Stable Diffusion (自建私有伺服器)</option>
                                    </select>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[11px] font-bold flex items-center justify-between">
                                        <span>影像處理 API Key / Token</span>
                                        <span class="text-[10px] opacity-60">x-api-key</span>
                                    </label>
                                    <div class="relative flex items-center">
                                        <input type="password" id="vault-image-key" placeholder="填入 Clipdrop / 影像服務 Key" class="vault-input-field w-full rounded-lg px-3 py-2 pr-10 text-xs font-mono">
                                        <button type="button" class="vault-toggle-pwd absolute right-3 text-xs opacity-60 hover:opacity-100">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 3: 簡報轉檔解析 -->
                        <div id="vault-view-ppt" class="space-y-4 hidden">
                            <div>
                                <h4 class="text-sm font-black flex items-center gap-2">
                                    <i class="fas fa-file-powerpoint text-sky-400"></i> 簡報轉檔解析 (PPT/PDF Parsing)
                                </h4>
                                <p class="text-xs opacity-75 mt-0.5">將企業 .ppt、.pptx 簡報高保真轉換為多頁面 PDF 匯入畫布。</p>
                            </div>

                            <div class="vault-section-card p-4 rounded-xl space-y-3">
                                <div class="space-y-1">
                                    <label class="text-[11px] font-bold">轉檔提供商</label>
                                    <select id="vault-ppt-provider" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs">
                                        <option value="convertapi">ConvertAPI (預設雲端方案)</option>
                                        <option value="cloudconvert">CloudConvert (雲端備用方案)</option>
                                        <option value="gotenberg">Gotenberg (LibreOffice Docker 自建)</option>
                                    </select>
                                </div>
                                <div class="space-y-1">
                                    <label class="text-[11px] font-bold flex items-center justify-between">
                                        <span>API Secret / 伺服器金鑰</span>
                                        <span class="text-[10px] opacity-60">Secret</span>
                                    </label>
                                    <div class="relative flex items-center">
                                        <input type="password" id="vault-ppt-secret" placeholder="填入 ConvertAPI Secret" class="vault-input-field w-full rounded-lg px-3 py-2 pr-10 text-xs font-mono">
                                        <button type="button" class="vault-toggle-pwd absolute right-3 text-xs opacity-60 hover:opacity-100">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Footer (56px) -->
                <div id="api-vault-footer" class="h-14 px-6 shrink-0 flex items-center justify-between border-t">
                    <div id="vault-active-badge" class="text-xs flex items-center gap-2 font-medium opacity-80">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span id="vault-active-model-text">作用中：OpenAI (GPT-4o)</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <button id="btn-cancel-api-vault" class="px-4 py-2 text-xs font-bold rounded-xl transition">
                            取消
                        </button>
                        <button id="btn-save-api-vault" class="px-5 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md">
                            <i class="fas fa-check"></i> 儲存設定
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
    }

    /**
     * 綁定 DOM 事件
     */
    bindEvents() {
        // 全域監聽開啟保險箱
        if (this.eventBus) {
            this.eventBus.on('VAULT:OPEN_MODAL', (data) => this.open(data));
            this.eventBus.on('API_VAULT:OPEN', (data) => this.open(data));
        }

        // 關閉與取消按鈕
        const btnClose = this.modal.querySelector('#btn-close-api-vault');
        const btnCancel = this.modal.querySelector('#btn-cancel-api-vault');
        const btnSave = this.modal.querySelector('#btn-save-api-vault');

        if (btnClose) btnClose.addEventListener('click', () => this.close());
        if (btnCancel) btnCancel.addEventListener('click', () => this.close());
        if (btnSave) btnSave.addEventListener('click', () => this.handleSubmit());

        // 點擊背景遮罩關閉
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // 側邊欄 Tab 切換
        const tabs = ['llm', 'image', 'ppt'];
        tabs.forEach(tab => {
            const btn = this.modal.querySelector(`#vault-tab-btn-${tab}`);
            if (btn) {
                btn.addEventListener('click', () => this.switchTab(tab));
            }
        });

        // LLM 子分頁切換
        const subtabBuiltin = this.modal.querySelector('#vault-subtab-builtin');
        const subtabCustom = this.modal.querySelector('#vault-subtab-custom');

        if (subtabBuiltin) {
            subtabBuiltin.addEventListener('click', () => this.switchLlmSubTab('builtin'));
        }
        if (subtabCustom) {
            subtabCustom.addEventListener('click', () => this.switchLlmSubTab('custom'));
        }

        // 密碼顯示/隱藏切換
        this.modal.querySelectorAll('.vault-toggle-pwd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = btn.closest('.relative').querySelector('input');
                if (input) {
                    if (input.type === 'password') {
                        input.type = 'text';
                        btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
                    } else {
                        input.type = 'password';
                        btn.innerHTML = '<i class="fas fa-eye"></i>';
                    }
                }
            });
        });

        // LLM Provider 切換時更新 Model 選項
        const builtinProvider = this.modal.querySelector('#vault-builtin-provider');
        const builtinModel = this.modal.querySelector('#vault-builtin-model');
        if (builtinProvider && builtinModel) {
            builtinProvider.addEventListener('change', () => {
                if (builtinProvider.value === 'anthropic') {
                    builtinModel.innerHTML = `
                        <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                    `;
                } else {
                    builtinModel.innerHTML = `
                        <option value="gpt-4o">GPT-4o (全能視覺旗艦)</option>
                        <option value="gpt-4o-mini">GPT-4o-mini (輕量極速)</option>
                    `;
                }
            });
        }
    }

    /**
     * 開啟保險箱
     */
    open(data = {}) {
        this.config = this.loadConfig();
        this.populateForm();

        if (data.tab) {
            this.switchTab(data.tab);
        } else {
            this.switchTab('llm');
        }

        this.modal.classList.remove('opacity-0', 'pointer-events-none');
    }

    /**
     * 關閉保險箱
     */
    close() {
        this.modal.classList.add('opacity-0', 'pointer-events-none');
    }

    /**
     * 切換主分頁
     */
    switchTab(tab) {
        this.activeTab = tab;
        const tabs = ['llm', 'image', 'ppt'];
        
        tabs.forEach(t => {
            const btn = this.modal.querySelector(`#vault-tab-btn-${t}`);
            const view = this.modal.querySelector(`#vault-view-${t}`);
            
            if (t === tab) {
                if (btn) btn.classList.add('is-active');
                if (view) view.classList.remove('hidden');
            } else {
                if (btn) btn.classList.remove('is-active');
                if (view) view.classList.add('hidden');
            }
        });
    }

    /**
     * 切換 LLM 子分頁
     */
    switchLlmSubTab(subtab) {
        this.activeLlmSubTab = subtab;
        const btnBuiltin = this.modal.querySelector('#vault-subtab-builtin');
        const btnCustom = this.modal.querySelector('#vault-subtab-custom');
        const contentBuiltin = this.modal.querySelector('#vault-subcontent-builtin');
        const contentCustom = this.modal.querySelector('#vault-subcontent-custom');

        if (subtab === 'builtin') {
            if (btnBuiltin) btnBuiltin.classList.add('is-active');
            if (btnCustom) btnCustom.classList.remove('is-active');
            if (contentBuiltin) contentBuiltin.classList.remove('hidden');
            if (contentCustom) contentCustom.classList.add('hidden');
        } else {
            if (btnCustom) btnCustom.classList.add('is-active');
            if (btnBuiltin) btnBuiltin.classList.remove('is-active');
            if (contentCustom) contentCustom.classList.remove('hidden');
            if (contentBuiltin) contentBuiltin.classList.add('hidden');
        }

        this.updateActiveBadge();
    }

    /**
     * 將當前設定填入表單
     */
    populateForm() {
        const c = this.config;

        // LLM Builtin
        const builtinProvider = this.modal.querySelector('#vault-builtin-provider');
        const builtinModel = this.modal.querySelector('#vault-builtin-model');
        const builtinKey = this.modal.querySelector('#vault-builtin-key');

        if (builtinProvider) builtinProvider.value = c.builtin?.provider || 'openai';
        if (builtinProvider) builtinProvider.dispatchEvent(new Event('change'));
        if (builtinModel) builtinModel.value = c.builtin?.model || 'gpt-4o';
        if (builtinKey) builtinKey.value = c.builtin?.apiKey || '';

        // LLM Custom
        const customName = this.modal.querySelector('#vault-custom-name');
        const customUrl = this.modal.querySelector('#vault-custom-url');
        const customModel = this.modal.querySelector('#vault-custom-model');
        const customToken = this.modal.querySelector('#vault-custom-token');

        if (customName) customName.value = c.custom?.name || '';
        if (customUrl) customUrl.value = c.custom?.baseUrl || '';
        if (customModel) customModel.value = c.custom?.modelId || '';
        if (customToken) customToken.value = c.custom?.token || '';

        // Image
        const imgProvider = this.modal.querySelector('#vault-image-provider');
        const imgKey = this.modal.querySelector('#vault-image-key');

        if (imgProvider) imgProvider.value = c.imageProcessing?.provider || 'clipdrop';
        if (imgKey) imgKey.value = c.imageProcessing?.apiKey || '';

        // PPT
        const pptProvider = this.modal.querySelector('#vault-ppt-provider');
        const pptSecret = this.modal.querySelector('#vault-ppt-secret');

        if (pptProvider) pptProvider.value = c.pptParsing?.provider || 'convertapi';
        if (pptSecret) pptSecret.value = c.pptParsing?.secret || '';

        this.switchLlmSubTab(c.activeLlmType || 'builtin');
        this.updateActiveBadge();
    }

    /**
     * 更新下方作用中模型標籤
     */
    updateActiveBadge() {
        const textEl = this.modal.querySelector('#vault-active-model-text');
        if (!textEl) return;

        if (this.activeLlmSubTab === 'builtin') {
            const model = this.modal.querySelector('#vault-builtin-model')?.value || 'GPT-4o';
            textEl.textContent = `作用中：內建模型 (${model})`;
        } else {
            const name = this.modal.querySelector('#vault-custom-name')?.value || '自訂端點';
            const model = this.modal.querySelector('#vault-custom-model')?.value || '自訂模型';
            textEl.textContent = `作用中：${name} (${model})`;
        }
    }

    /**
     * 處理表單送出儲存
     */
    handleSubmit() {
        const newConfig = {
            activeLlmType: this.activeLlmSubTab,
            builtin: {
                provider: this.modal.querySelector('#vault-builtin-provider')?.value || 'openai',
                model: this.modal.querySelector('#vault-builtin-model')?.value || 'gpt-4o',
                apiKey: this.modal.querySelector('#vault-builtin-key')?.value.trim() || ''
            },
            custom: {
                name: this.modal.querySelector('#vault-custom-name')?.value.trim() || '',
                baseUrl: this.modal.querySelector('#vault-custom-url')?.value.trim() || '',
                modelId: this.modal.querySelector('#vault-custom-model')?.value.trim() || '',
                token: this.modal.querySelector('#vault-custom-token')?.value.trim() || ''
            },
            imageProcessing: {
                provider: this.modal.querySelector('#vault-image-provider')?.value || 'clipdrop',
                apiKey: this.modal.querySelector('#vault-image-key')?.value.trim() || ''
            },
            pptParsing: {
                provider: this.modal.querySelector('#vault-ppt-provider')?.value || 'convertapi',
                secret: this.modal.querySelector('#vault-ppt-secret')?.value.trim() || ''
            }
        };

        this.saveConfig(newConfig);
    }

    /**
     * 輕量 Toast 提示
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-6 right-6 z-[10000] px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce ${
            type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white border border-slate-700'
        }`;
        toast.innerHTML = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
}
