/**
 * AuthManager.js - 角色帳號、登入/註冊與權限控管系統 (Sprint 3 · v1.4.0)
 * 支援：
 * 1. 預設公用最高管理者帳密 (admin / admin888)
 * 2. 登入 / 註冊 / 訪客模式與記住我 (LocalStorage / SessionStorage)
 * 3. RBAC 角色模型 (Admin / Editor / Viewer)
 * 4. 右上角使用者頭像、角色標籤與帳號控制選單
 * 5. 系統金鑰保險箱 (API Vault: Clipdrop / Spark / 自訂模型)
 */

export default class AuthManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.storageKeyUsers = 'editorv2_users_db';
        this.storageKeySession = 'editorv2_current_user';
        this.storageKeyApiVault = 'editorv2_api_vault';
        
        // 預設公用最高管理者 (高強度憑證)
        this.defaultMasterAdmin = {
            id: 'user_master_admin',
            username: 'admin_master',
            password: 'Admin@Canvas2026#ProSecure!',
            name: '系統最高管理者 (Admin)',
            email: 'admin.master@editor.local',
            role: 'admin', // 'admin', 'editor', 'viewer'
            avatarColor: '#4f46e5',
            createdAt: Date.now()
        };

        this.currentUser = null;
        this.authGateElement = null;
        this.apiVaultModal = null;

        this.init();
    }

    init() {
        this.initUsersDatabase();
        this.initApiVaultStorage();
        this.loadSession();
        this.createAuthGateDOM();
        this.createApiVaultModalDOM();
        this.bindEvents();

        // 監聽儀表板就緒與主題變更事件，動態刷新頭像與選單
        if (this.eventBus) {
            this.eventBus.on('DASHBOARD:READY', () => {
                if (this.currentUser) this.updateHeaderUserProfiles();
            });
            this.eventBus.on('THEME:CHANGED', () => {
                if (this.currentUser) this.updateHeaderUserProfiles();
            });
        }

        // 如果已登入，更新全域介面
        if (this.currentUser) {
            this.hideAuthGate();
            this.updateHeaderUserProfiles();
        } else {
            this.showAuthGate();
        }
    }

    /**
     * 初始化本地使用者資料庫
     */
    initUsersDatabase() {
        try {
            const raw = localStorage.getItem(this.storageKeyUsers);
            if (!raw) {
                const initialUsers = [this.defaultMasterAdmin];
                localStorage.setItem(this.storageKeyUsers, JSON.stringify(initialUsers));
            } else {
                let users = JSON.parse(raw);
                // 確保預設高強度管理者帳號存在並更新為最新憑證
                const masterIdx = users.findIndex(u => u.username === 'admin_master' || u.username === 'admin');
                if (masterIdx >= 0) {
                    users[masterIdx] = {
                        ...users[masterIdx],
                        username: 'admin_master',
                        password: 'Admin@Canvas2026#ProSecure!',
                        name: '系統最高管理者 (Admin)',
                        role: 'admin'
                    };
                } else {
                    users.unshift(this.defaultMasterAdmin);
                }
                localStorage.setItem(this.storageKeyUsers, JSON.stringify(users));
            }
        } catch (e) {
            console.error('[AuthManager] 初始化使用者資料庫失敗:', e);
        }
    }

    /**
     * 初始化 API 金鑰保險箱存儲
     */
    initApiVaultStorage() {
        try {
            const raw = localStorage.getItem(this.storageKeyApiVault);
            if (!raw) {
                const initialVault = {
                    clipdropKey: localStorage.getItem('clipdrop_api_key') || '',
                    sparkEndpoint: 'https://spark-api.xf-yun.com/v1.1/chat',
                    sparkAppId: '',
                    sparkApiKey: '',
                    sparkApiSecret: '',
                    updatedAt: Date.now()
                };
                localStorage.setItem(this.storageKeyApiVault, JSON.stringify(initialVault));
            }
        } catch (e) {
            console.error('[AuthManager] 初始化 API Vault 失敗:', e);
        }
    }

    /**
     * 讀取登入 Session (優先讀取 localStorage，其次 sessionStorage)
     */
    loadSession() {
        try {
            const localUser = localStorage.getItem(this.storageKeySession);
            const sessionUser = sessionStorage.getItem(this.storageKeySession);
            
            if (localUser) {
                this.currentUser = JSON.parse(localUser);
            } else if (sessionUser) {
                this.currentUser = JSON.parse(sessionUser);
            }
        } catch (e) {
            console.error('[AuthManager] 讀取 Session 失敗:', e);
            this.currentUser = null;
        }
    }

    /**
     * 儲存登入 Session
     */
    saveSession(user, rememberMe = true) {
        this.currentUser = user;
        const json = JSON.stringify(user);
        if (rememberMe) {
            localStorage.setItem(this.storageKeySession, json);
            sessionStorage.removeItem(this.storageKeySession);
        } else {
            sessionStorage.setItem(this.storageKeySession, json);
            localStorage.removeItem(this.storageKeySession);
        }
        // 兼容舊版 demo_unlocked
        sessionStorage.setItem('demo_unlocked', 'true');
    }

    /**
     * 清除 Session / 登出
     */
    clearSession() {
        this.currentUser = null;
        localStorage.removeItem(this.storageKeySession);
        sessionStorage.removeItem(this.storageKeySession);
        sessionStorage.removeItem('demo_unlocked');
    }

    /**
     * 取得所有註冊使用者清單
     */
    getAllUsers() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKeyUsers)) || [this.defaultMasterAdmin];
        } catch (e) {
            return [this.defaultMasterAdmin];
        }
    }

    /**
     * 登入驗證
     */
    login(username, password, rememberMe = true) {
        const users = this.getAllUsers();
        const cleanUser = username.trim().toLowerCase();
        
        const found = users.find(u => {
            const matchUser = u.username.toLowerCase() === cleanUser || 
                              (u.email && u.email.toLowerCase() === cleanUser) ||
                              (cleanUser === 'admin' && u.username.toLowerCase() === 'admin_master');
            return matchUser && u.password === password;
        });

        if (found) {
            const sessionUser = {
                id: found.id,
                username: found.username,
                name: found.name || found.username,
                email: found.email || '',
                role: found.role || 'admin',
                avatarColor: found.avatarColor || '#4f46e5',
                lastLoginAt: Date.now()
            };
            this.saveSession(sessionUser, rememberMe);
            if (this.eventBus) {
                this.eventBus.emit('AUTH:LOGIN_SUCCESS', sessionUser);
            }
            return { success: true, user: sessionUser };
        } else {
            return { success: false, message: '帳號或密碼錯誤，請重新確認！' };
        }
    }

    /**
     * 註冊新帳號 (目前處於封閉測試階段，暫停開放外部註冊)
     */
    register(data, rememberMe = true) {
        return {
            success: false,
            message: '⚠️ 目前系統處於內部封閉測試階段，暫停開放公開註冊。請使用內部授權帳號登入！'
        };
    }

    /**
     * 登出
     */
    logout() {
        this.clearSession();
        if (this.eventBus) {
            this.eventBus.emit('AUTH:LOGOUT');
        }
        this.showAuthGate();
    }

    /**
     * 建立登入 / 註冊手繪風認證 Modal DOM
     */
    createAuthGateDOM() {
        // 如果舊的 password-gate 存在，先移除或替換
        const oldGate = document.getElementById('password-gate');
        if (oldGate) {
            oldGate.remove();
        }

        this.authGateElement = document.createElement('div');
        this.authGateElement.id = 'auth-gate-modal';
        this.authGateElement.className = 'fixed inset-0 z-[9999] bg-white flex items-center justify-center p-4 transition-all duration-300 select-none';

        const currentTheme = localStorage.getItem('editor_theme') || 'light';

        this.authGateElement.innerHTML = `
            <div id="auth-card-panel" class="sketch-panel max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-700 flex flex-col animate-scale-in transition-all duration-300">
                <!-- Auth Header -->
                <div id="auth-card-header" class="p-6 text-center relative transition-all duration-300">
                    <div id="auth-header-logo-box" class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 transition-all duration-300">
                        <i class="fas fa-cubes text-2xl"></i>
                    </div>
                    <h2 id="auth-header-title" class="text-2xl font-black tracking-wide">多媒體畫布編輯器 V2</h2>
                    <p id="auth-header-subtitle" class="text-xs mt-1 font-medium">Sprint 3 系統登入與權限管理中心</p>
                    <span id="auth-version-badge" class="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full font-mono">v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.0'}</span>

                    <!-- Theme Switcher Toolbar (登入介面即時風格切換) -->
                    <div class="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs" id="auth-theme-toolbar-container">
                        <span id="auth-theme-toolbar-label" class="text-[11px] font-medium flex items-center gap-1.5">
                            <i class="fas fa-palette"></i> 介面風格體驗：
                        </span>
                        <div class="flex items-center gap-1.5" id="auth-theme-switcher">
                            <button type="button" data-auth-theme="light" class="auth-theme-pill px-2 py-0.5 rounded-full text-[10px] font-bold transition flex items-center gap-1" title="經典手繪風格 (Light Sketch)">
                                <span>🎨 手繪</span>
                            </button>
                            <button type="button" data-auth-theme="dark" class="auth-theme-pill px-2 py-0.5 rounded-full text-[10px] font-bold transition flex items-center gap-1" title="深色極客風格 (Dark Geek)">
                                <span>🌙 極客</span>
                            </button>
                            <button type="button" data-auth-theme="pro-slate" class="auth-theme-pill px-2 py-0.5 rounded-full text-[10px] font-bold transition flex items-center gap-1" title="專業冷灰風格 (Pro Slate)">
                                <span>💼 冷灰</span>
                            </button>
                            <button type="button" data-auth-theme="retro-warm" class="auth-theme-pill px-2 py-0.5 rounded-full text-[10px] font-bold transition flex items-center gap-1" title="復古文青風格 (Retro Warm)">
                                <span>📜 復古</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Tabs (登入 / 註冊) -->
                <div id="auth-tabs-container" class="flex border-b-2 border-slate-700 bg-slate-100 font-bold text-sm">
                    <button id="auth-tab-login" class="flex-1 py-3 text-center border-b-2 border-amber-500 bg-white text-slate-800 transition flex items-center justify-center gap-2 is-active">
                        <i class="fas fa-sign-in-alt"></i> 帳號登入
                    </button>
                    <button id="auth-tab-register" class="flex-1 py-3 text-center border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-2">
                        <i class="fas fa-user-plus"></i> 註冊帳號
                    </button>
                </div>

                <!-- Auth Body -->
                <div id="auth-body-container" class="p-6 transition-all duration-300">
                    <!-- 1. 登入表單 (Login Form) -->
                    <form id="form-auth-login" class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1 auth-input-label">使用者帳號 / 信箱</label>
                            <div class="auth-input-wrapper">
                                <i class="fas fa-user auth-input-icon"></i>
                                <input type="text" id="login-username" required class="auth-input-field" placeholder="請輸入帳號或 Email">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1 auth-input-label">密碼</label>
                            <div class="auth-input-wrapper">
                                <i class="fas fa-lock auth-input-icon"></i>
                                <input type="password" id="login-password" required class="auth-input-field" placeholder="••••••••">
                                <button type="button" id="btn-toggle-login-pwd" title="顯示/隱藏密碼">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>

                        <div class="flex items-center justify-between text-xs text-slate-600">
                            <label class="flex items-center gap-1.5 cursor-pointer" id="auth-remember-label">
                                <input type="checkbox" id="login-remember-me" checked class="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300">
                                <span>記住我的登入狀態</span>
                            </label>
                            <span id="auth-encryption-text" class="text-slate-400 text-[11px]">本機安全加密存儲</span>
                        </div>

                        <div id="login-error-msg" class="hidden p-2.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg font-bold flex items-center gap-2">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="login-error-text">帳號或密碼錯誤</span>
                        </div>

                        <button type="submit" id="btn-submit-login" class="sketch-btn w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-[2px_2px_0px_#334155] flex items-center justify-center gap-2">
                            <i class="fas fa-sign-in-alt"></i> 登入系統
                        </button>
                    </form>

                    <!-- 2. 註冊表單 (Register Form - 暫停開放) -->
                    <form id="form-auth-register" class="space-y-3.5 hidden">
                        <!-- 暫停開放提示橫幅 -->
                        <div class="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex items-start gap-2.5 shadow-xs">
                            <i class="fas fa-lock text-amber-600 mt-0.5 text-sm shrink-0"></i>
                            <div>
                                <div class="font-bold">註冊通道暫停開放</div>
                                <div class="text-[11px] text-amber-700 mt-0.5 leading-relaxed">目前系統處於內部封閉測試與安全維護階段，暫不開放公開註冊。請使用內部授權帳號登入！</div>
                            </div>
                        </div>

                        <div class="opacity-60 pointer-events-none space-y-3">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1 auth-input-label">登入帳號</label>
                                <input type="text" id="reg-username" disabled class="auth-input-field w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-400 cursor-not-allowed" placeholder="例如: designer_alex">
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1 auth-input-label">顯示名稱 / 暱稱</label>
                                <input type="text" id="reg-name" disabled class="auth-input-field w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-400 cursor-not-allowed" placeholder="例如: Alex 視覺設計">
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1 auth-input-label">設定密碼</label>
                                <input type="password" id="reg-password" disabled class="auth-input-field w-full bg-slate-100 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-400 cursor-not-allowed" placeholder="••••••••">
                            </div>
                        </div>

                        <div id="reg-error-msg" class="hidden p-2.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg font-bold flex items-center gap-2">
                            <i class="fas fa-exclamation-circle"></i>
                            <span id="reg-error-text">目前暫停開放公開註冊</span>
                        </div>

                        <button type="button" id="btn-submit-register" disabled class="w-full py-3 bg-slate-200 text-slate-400 font-bold rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2 border border-slate-300 shadow-none transition select-none">
                            <i class="fas fa-ban"></i> 註冊功能暫停開放
                        </button>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(this.authGateElement);
        this.updateAuthThemeSwitcherUI(currentTheme);
    }

    /**
     * 建立系統金鑰保險箱 (API Vault Modal) DOM
     */
    createApiVaultModalDOM() {
        const existing = document.getElementById('api-vault-modal');
        if (existing) existing.remove();

        this.apiVaultModal = document.createElement('div');
        this.apiVaultModal.id = 'api-vault-modal';
        this.apiVaultModal.className = 'fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300 opacity-0 pointer-events-none select-none';

        const vaultData = this.getApiVaultData();

        this.apiVaultModal.innerHTML = `
            <!-- 固定長寬卡片：寬 580px、高 560px，內容滾動，尺寸絕不隨內容跳動 -->
            <div id="api-vault-card" class="w-[580px] h-[560px] max-w-[95vw] max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                <!-- Vault Header (固定高度 64px) -->
                <div id="api-vault-header" class="h-16 px-6 shrink-0 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div id="api-vault-logo-box" class="w-10 h-10 rounded-xl flex items-center justify-center text-lg">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <h3 id="api-vault-title" class="text-base font-black tracking-wide">系統金鑰保險箱 (API Vault)</h3>
                            <p id="api-vault-subtitle" class="text-xs">本機安全儲存 AI 模型連接金鑰與伺服器端點</p>
                        </div>
                    </div>
                    <button id="btn-close-api-vault" class="w-8 h-8 rounded-lg flex items-center justify-center transition">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>

                <!-- Vault Content (固定填滿中間高度，支援獨立滾動) -->
                <div id="api-vault-body" class="p-6 space-y-4 flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                    <!-- Clipdrop Key -->
                    <div class="vault-section-card p-4 rounded-xl space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold flex items-center gap-2 vault-card-label">
                                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Clipdrop API Key (智慧生圖/去背)
                            </label>
                            <span class="text-[10px] px-2 py-0.5 rounded font-bold vault-badge-active">現行運作中</span>
                        </div>
                        <p class="text-[11px] vault-card-desc">用於高畫質智慧去背、AI 物件消除、影像邊界擴展等功能。</p>
                        <input type="password" id="vault-clipdrop-key" value="${vaultData.clipdropKey || ''}" class="vault-input-field w-full rounded-lg px-3 py-2 text-xs font-mono transition" placeholder="輸入 Clipdrop API 金鑰...">
                    </div>

                    <!-- Spark (星火/企業私有模型) 預備通道 (Sprint 4 Preview) -->
                    <div class="vault-section-card p-4 rounded-xl space-y-3">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold flex items-center gap-2 vault-card-label">
                                <span class="w-2 h-2 rounded-full bg-purple-500"></span> Spark (星火/私有模型) 連接器
                            </label>
                            <span class="text-[10px] px-2 py-0.5 rounded font-bold vault-badge-preview">Sprint 4 預備</span>
                        </div>
                        <p class="text-[11px] vault-card-desc">供公司內網 Spark 伺服器或企業專屬大模型介接使用。</p>
                        
                        <div class="space-y-2">
                            <div>
                                <label class="text-[11px] font-bold block mb-0.5 vault-sub-label">API Endpoint (伺服器端點)</label>
                                <input type="text" id="vault-spark-endpoint" value="${vaultData.sparkEndpoint || ''}" class="vault-input-field w-full rounded-lg px-3 py-1.5 text-xs font-mono transition">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="text-[11px] font-bold block mb-0.5 vault-sub-label">APP ID</label>
                                    <input type="text" id="vault-spark-appid" value="${vaultData.sparkAppId || ''}" class="vault-input-field w-full rounded-lg px-3 py-1.5 text-xs font-mono transition" placeholder="例如: 8a7b6c5d">
                                </div>
                                <div>
                                    <label class="text-[11px] font-bold block mb-0.5 vault-sub-label">API Secret</label>
                                    <input type="password" id="vault-spark-secret" value="${vaultData.sparkApiSecret || ''}" class="vault-input-field w-full rounded-lg px-3 py-1.5 text-xs font-mono transition" placeholder="••••••••">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Vault Footer (固定高度 56px) -->
                <div id="api-vault-footer" class="h-14 px-6 shrink-0 flex items-center justify-between">
                    <span id="vault-save-feedback" class="text-xs font-bold hidden">
                        <i class="fas fa-check-circle mr-1"></i> 金鑰已安全保存至本機！
                    </span>
                    <div class="flex items-center gap-2 ml-auto">
                        <button id="btn-cancel-api-vault" class="px-4 py-2 text-xs font-bold rounded-xl transition">取消</button>
                        <button id="btn-save-api-vault" class="px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 transition">
                            <i class="fas fa-save"></i> 儲存設定
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.apiVaultModal);
    }

    /**
     * 讀取 API Vault 數據
     */
    getApiVaultData() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKeyApiVault)) || {};
        } catch (e) {
            return {};
        }
    }

    /**
     * 儲存 API Vault 數據
     */
    saveApiVaultData(data) {
        const updated = {
            ...this.getApiVaultData(),
            ...data,
            updatedAt: Date.now()
        };
        localStorage.setItem(this.storageKeyApiVault, JSON.stringify(updated));
        
        // 同步相容舊版 clipdrop_api_key
        if (data.clipdropKey !== undefined) {
            localStorage.setItem('clipdrop_api_key', data.clipdropKey);
        }

        if (this.eventBus) {
            this.eventBus.emit('API_VAULT:UPDATED', updated);
        }
        return updated;
    }

    showAuthGate() {
        if (this.authGateElement) {
            this.authGateElement.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            this.authGateElement.classList.add('flex');
        }
    }

    hideAuthGate() {
        if (this.authGateElement) {
            this.authGateElement.classList.add('hidden', 'opacity-0', 'pointer-events-none');
            this.authGateElement.classList.remove('flex');
        }
    }

    openApiVault() {
        if (this.apiVaultModal) {
            // 重新填入最新數據
            const data = this.getApiVaultData();
            const clipKeyEl = document.getElementById('vault-clipdrop-key');
            const sparkEndEl = document.getElementById('vault-spark-endpoint');
            const sparkAppEl = document.getElementById('vault-spark-appid');
            const sparkSecEl = document.getElementById('vault-spark-secret');
            
            if (clipKeyEl) clipKeyEl.value = data.clipdropKey || '';
            if (sparkEndEl) sparkEndEl.value = data.sparkEndpoint || '';
            if (sparkAppEl) sparkAppEl.value = data.sparkAppId || '';
            if (sparkSecEl) sparkSecEl.value = data.sparkApiSecret || '';

            this.apiVaultModal.classList.remove('opacity-0', 'pointer-events-none');
        }
    }

    closeApiVault() {
        if (this.apiVaultModal) {
            this.apiVaultModal.classList.add('opacity-0', 'pointer-events-none');
        }
    }

    /**
     * 更新 Dashboard Header 與 Editor Header 上的使用者資訊與下拉選單
     */
    updateHeaderUserProfiles() {
        const user = this.currentUser || this.defaultMasterAdmin;
        const roleBadges = {
            admin: '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">👑 管理者</span>',
            editor: '<span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold border border-indigo-300">✏️ 協作者</span>',
            viewer: '<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-300">👁️ 訪客</span>'
        };

        const avatarInitial = (user.name || user.username || 'A').charAt(0).toUpperCase();

        // 渲染或更新 Editor Header 右側的使用者 Profile 區塊
        let editorUserContainer = document.getElementById('editor-user-profile-widget');
        if (!editorUserContainer) {
            const headerRight = document.querySelector('header .flex.items-center.gap-2.shrink-0');
            if (headerRight) {
                editorUserContainer = document.createElement('div');
                editorUserContainer.id = 'editor-user-profile-widget';
                editorUserContainer.className = 'relative ml-1';
                headerRight.appendChild(editorUserContainer);
            }
        }

        if (editorUserContainer) {
            editorUserContainer.innerHTML = `
                <button id="btn-editor-user-menu" class="sketch-btn px-2 py-1 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs shadow-[1.5px_1.5px_0px_#334155]" title="帳號與權限選單">
                    <div class="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black" style="background-color: ${user.avatarColor || '#4f46e5'};">
                        ${avatarInitial}
                    </div>
                    <span class="max-w-[80px] truncate hidden md:inline">${user.name || user.username}</span>
                    <i class="fas fa-chevron-down text-[9px] opacity-60"></i>
                </button>

                <!-- User Dropdown Menu -->
                <div id="editor-user-dropdown" class="hidden absolute top-full right-0 mt-1 w-56 bg-white border-2 border-slate-700 rounded-xl shadow-2xl z-[100] overflow-hidden py-1">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div class="text-xs font-black text-slate-800 truncate">${user.name || user.username}</div>
                        <div class="text-[11px] text-slate-500 truncate mb-1.5 font-mono">@${user.username}</div>
                        ${roleBadges[user.role] || roleBadges.admin}
                    </div>
                    <button id="menu-btn-api-vault" class="w-full px-4 py-2 text-xs text-left hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-2.5">
                        <i class="fas fa-key text-amber-500 w-4"></i> 系統金鑰保險箱 (API)
                    </button>
                    <button id="menu-btn-settings" class="w-full px-4 py-2 text-xs text-left hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-2.5">
                        <i class="fas fa-palette text-indigo-500 w-4"></i> 外觀與風格設定
                    </button>
                    <div class="border-t border-slate-100 my-1"></div>
                    <button id="menu-btn-logout" class="w-full px-4 py-2 text-xs text-left hover:bg-rose-50 font-bold text-rose-600 flex items-center gap-2.5">
                        <i class="fas fa-sign-out-alt w-4"></i> 切換帳號 / 登出
                    </button>
                </div>
            `;
            this.bindDropdownEvents('btn-editor-user-menu', 'editor-user-dropdown');
        }

        // 渲染或更新 Dashboard Header 右側的使用者 Profile 區塊
        const dashboardHeaderRight = document.querySelector('#dashboard-view header .flex.items-center.space-x-3');
        if (dashboardHeaderRight) {
            let dashUserContainer = document.getElementById('dashboard-user-profile-widget');
            if (!dashUserContainer) {
                dashUserContainer = document.createElement('div');
                dashUserContainer.id = 'dashboard-user-profile-widget';
                dashUserContainer.className = 'relative ml-2';
                dashboardHeaderRight.appendChild(dashUserContainer);
            }

            dashUserContainer.innerHTML = `
                <button id="btn-dash-user-menu" class="sketch-btn px-3 py-1.5 flex items-center gap-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-[2px_2px_0px_#334155]">
                    <div class="w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-black" style="background-color: ${user.avatarColor || '#4f46e5'};">
                        ${avatarInitial}
                    </div>
                    <span class="max-w-[100px] truncate">${user.name || user.username}</span>
                    <i class="fas fa-chevron-down text-xs opacity-60"></i>
                </button>

                <!-- Dashboard User Dropdown Menu -->
                <div id="dash-user-dropdown" class="hidden absolute top-full right-0 mt-1.5 w-60 bg-white border-2 border-slate-700 rounded-xl shadow-2xl z-[100] overflow-hidden py-1">
                    <div class="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div class="text-sm font-black text-slate-800 truncate">${user.name || user.username}</div>
                        <div class="text-xs text-slate-500 truncate mb-2 font-mono">@${user.username}</div>
                        ${roleBadges[user.role] || roleBadges.admin}
                    </div>
                    <button id="dash-menu-btn-api-vault" class="w-full px-4 py-2.5 text-xs text-left hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-2.5">
                        <i class="fas fa-key text-amber-500 w-4"></i> 系統金鑰保險箱 (API)
                    </button>
                    <button id="dash-menu-btn-settings" class="w-full px-4 py-2.5 text-xs text-left hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-2.5">
                        <i class="fas fa-palette text-indigo-500 w-4"></i> 外觀與風格設定
                    </button>
                    <div class="border-t border-slate-100 my-1"></div>
                    <button id="dash-menu-btn-logout" class="w-full px-4 py-2.5 text-xs text-left hover:bg-rose-50 font-bold text-rose-600 flex items-center gap-2.5">
                        <i class="fas fa-sign-out-alt w-4"></i> 切換帳號 / 登出
                    </button>
                </div>
            `;
            this.bindDropdownEvents('btn-dash-user-menu', 'dash-user-dropdown');
        }
    }

    /**
     * 綁定下拉選單與全域點擊收合邏輯
     */
    bindDropdownEvents(btnId, dropdownId) {
        const btn = document.getElementById(btnId);
        const dropdown = document.getElementById(dropdownId);
        if (!btn || !dropdown) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains('hidden');
            // 關閉其他可能開啟的選單
            document.querySelectorAll('#editor-user-dropdown, #dash-user-dropdown').forEach(d => d.classList.add('hidden'));
            if (isHidden) {
                dropdown.classList.remove('hidden');
            }
        });

        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        });

        // 綁定選單內的按鈕
        const btnVault = dropdown.querySelector('[id*="menu-btn-api-vault"]');
        if (btnVault) {
            btnVault.addEventListener('click', () => {
                dropdown.classList.add('hidden');
                this.openApiVault();
            });
        }

        const btnSettings = dropdown.querySelector('[id*="menu-btn-settings"]');
        if (btnSettings) {
            btnSettings.addEventListener('click', () => {
                dropdown.classList.add('hidden');
                const themeSettingsBtn = document.getElementById('btn-editor-settings') || document.getElementById('btn-dashboard-settings');
                if (themeSettingsBtn) themeSettingsBtn.click();
            });
        }

        const btnLogout = dropdown.querySelector('[id*="menu-btn-logout"]');
        if (btnLogout) {
            btnLogout.addEventListener('click', () => {
                dropdown.classList.add('hidden');
                this.logout();
            });
        }
    }

    /**
     * 綁定登入/註冊表單與快捷鍵事件
     */
    bindEvents() {
        // Tab 切換
        const tabLogin = document.getElementById('auth-tab-login');
        const tabRegister = document.getElementById('auth-tab-register');
        const formLogin = document.getElementById('form-auth-login');
        const formRegister = document.getElementById('form-auth-register');

        if (tabLogin && tabRegister && formLogin && formRegister) {
            tabLogin.addEventListener('click', () => {
                tabLogin.classList.add('is-active');
                tabRegister.classList.remove('is-active');
                formLogin.classList.remove('hidden');
                formRegister.classList.add('hidden');
            });

            tabRegister.addEventListener('click', () => {
                tabRegister.classList.add('is-active');
                tabLogin.classList.remove('is-active');
                formRegister.classList.remove('hidden');
                formLogin.classList.add('hidden');
            });
        }

        // 登入彈窗風格快速切換監聽
        const themeSwitcher = document.getElementById('auth-theme-switcher');
        if (themeSwitcher) {
            themeSwitcher.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-auth-theme]');
                if (!btn) return;
                const themeId = btn.dataset.authTheme;
                this.switchModalTheme(themeId);
            });
        }

        if (this.eventBus) {
            this.eventBus.on('THEME:CHANGED', ({ themeId }) => {
                this.updateAuthThemeSwitcherUI(themeId);
            });
        }

        const loginUserEl = document.getElementById('login-username');
        const loginPwdEl = document.getElementById('login-password');

        // 密碼顯隱切換
        const btnTogglePwd = document.getElementById('btn-toggle-login-pwd');
        if (btnTogglePwd && loginPwdEl) {
            btnTogglePwd.addEventListener('click', () => {
                const isPwd = loginPwdEl.type === 'password';
                loginPwdEl.type = isPwd ? 'text' : 'password';
                btnTogglePwd.innerHTML = isPwd ? '<i class="fas fa-eye-slash text-sm text-indigo-600"></i>' : '<i class="fas fa-eye text-sm"></i>';
            });
        }

        // 登入表單提交
        if (formLogin) {
            formLogin.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = loginUserEl.value;
                const password = loginPwdEl.value;
                const rememberMe = document.getElementById('login-remember-me')?.checked ?? true;
                const errorBox = document.getElementById('login-error-msg');
                const errorText = document.getElementById('login-error-text');

                const res = this.login(username, password, rememberMe);
                if (res.success) {
                    if (errorBox) errorBox.classList.add('hidden');
                    this.hideAuthGate();
                    this.updateHeaderUserProfiles();
                } else {
                    if (errorBox && errorText) {
                        errorText.textContent = res.message;
                        errorBox.classList.remove('hidden');
                    }
                }
            });
        }

        // 註冊表單提交
        if (formRegister) {
            formRegister.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('reg-username')?.value;
                const name = document.getElementById('reg-name')?.value;
                const password = document.getElementById('reg-password')?.value;
                const role = document.getElementById('reg-role')?.value || 'editor';
                const errorBox = document.getElementById('reg-error-msg');
                const errorText = document.getElementById('reg-error-text');

                const res = this.register({ username, name, password, role }, true);
                if (res.success) {
                    if (errorBox) errorBox.classList.add('hidden');
                    this.hideAuthGate();
                    this.updateHeaderUserProfiles();
                } else {
                    if (errorBox && errorText) {
                        errorText.textContent = res.message;
                        errorBox.classList.remove('hidden');
                    }
                }
            });
        }

        // API Vault 儲存與關閉
        const btnCloseVault = document.getElementById('btn-close-api-vault');
        const btnCancelVault = document.getElementById('btn-cancel-api-vault');
        const btnSaveVault = document.getElementById('btn-save-api-vault');
        const feedbackEl = document.getElementById('vault-save-feedback');

        if (btnCloseVault) btnCloseVault.addEventListener('click', () => this.closeApiVault());
        if (btnCancelVault) btnCancelVault.addEventListener('click', () => this.closeApiVault());

        if (btnSaveVault) {
            btnSaveVault.addEventListener('click', () => {
                const clipdropKey = document.getElementById('vault-clipdrop-key')?.value.trim();
                const sparkEndpoint = document.getElementById('vault-spark-endpoint')?.value.trim();
                const sparkAppId = document.getElementById('vault-spark-appid')?.value.trim();
                const sparkApiSecret = document.getElementById('vault-spark-secret')?.value.trim();

                this.saveApiVaultData({
                    clipdropKey,
                    sparkEndpoint,
                    sparkAppId,
                    sparkApiSecret
                });

                if (feedbackEl) {
                    feedbackEl.classList.remove('hidden');
                    setTimeout(() => {
                        feedbackEl.classList.add('hidden');
                        this.closeApiVault();
                    }, 800);
                } else {
                    this.closeApiVault();
                }
            });
        }
    }

    /**
     * 切換登入彈窗風格並同步至全域主題
     */
    switchModalTheme(themeId) {
        document.documentElement.setAttribute('data-theme', themeId);
        document.body.setAttribute('data-theme', themeId);
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-pro-slate', 'theme-retro-warm');
        document.body.classList.add(`theme-${themeId}`);
        localStorage.setItem('editor_theme', themeId);

        this.updateAuthThemeSwitcherUI(themeId);

        if (this.eventBus) {
            this.eventBus.emit('THEME:SET', { themeId });
        }
    }

    /**
     * 更新登入彈窗右上角主題切換器的高亮狀態
     */
    updateAuthThemeSwitcherUI(currentTheme) {
        const switcher = document.getElementById('auth-theme-switcher');
        if (!switcher) return;

        const buttons = switcher.querySelectorAll('[data-auth-theme]');
        buttons.forEach(btn => {
            const isCurrent = btn.dataset.authTheme === currentTheme;
            btn.classList.toggle('is-active', isCurrent);
        });
    }
}
