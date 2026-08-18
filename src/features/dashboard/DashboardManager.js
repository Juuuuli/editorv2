import * as pdfjsLib from 'pdfjs-dist';
import ApiVaultManager from '../vault/ApiVaultManager.js';
import RetinaRenderer from '../canvas_auxiliary/RetinaRenderer.js';
import FirebaseProvider from '../collaboration/FirebaseProvider.js';

// 初始化 PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export default class DashboardManager {
    constructor(storageEngine, eventBus, canvasEngine, workspaceManager) {
        this.storageEngine = storageEngine;
        this.eventBus = eventBus;
        this.canvasEngine = canvasEngine;
        this.workspaceManager = workspaceManager;

        this.isSelectionMode = false;
        this.selectedProjectIds = new Set();

        this.currentProjectId = null;
        this.currentFilter = 'ALL'; // 'ALL', 'IMAGE', 'PDF'
        this.searchQuery = '';
        this.projects = [];

        this.dashboardContainer = null;
        this.editorContainer = null;

        this.init();
    }

    async init() {
        this.createDashboardDOM();
        this.bindEvents();
        await this.loadProjects();

        // 預設檢查：如果從未建立過專案，自動建立一個預設專案引導使用者
        if (this.projects.length === 0) {
            await this.storageEngine.createBlankProject({
                name: '我的第一個專案 (簡報模式)',
                type: 'PDF',
                width: 1280,
                height: 720,
                ratio: '16:9'
            });
            await this.loadProjects();
        }

        // 監聽畫布異動，進行防抖 Auto-Save
        this.setupAutoSave();

        // 監聽登入成功事件，若之前有未處理的 Deep Link 則在此執行
        if (this.eventBus) {
            this.eventBus.on('AUTH:LOGIN_SUCCESS', () => {
                const urlParams = new URLSearchParams(window.location.search);
                const urlProjectId = urlParams.get('project') || urlParams.get('projectId');
                if (urlProjectId) {
                    // 有專案 ID → 嘗試 Deep Link 直通
                    this.handleInitialRouting();
                } else {
                    // 無專案 ID → 確保 Dashboard 顯示
                    this.showDashboard();
                }
            });
        }

        // 監聽 Yjs 引擎準備完成事件，用於同步專案 Metadata (取代跨分頁 BroadcastChannel)
        if (this.eventBus) {
            this.eventBus.on('COLLAB:ENGINE_READY', async ({ ydoc }) => {
                this.ydoc = ydoc;
                this.yMetadata = ydoc.getMap('metadata');
                
                if (this.currentProjectId) {
                    // 我是房主 (或已載入專案的訪客)，將當前專案資料推上雲端
                    const proj = await this.storageEngine.getProject(this.currentProjectId);
                    if (proj) {
                        const projSync = { ...proj };
                        delete projSync.thumbnail; // 過濾縮圖以節省頻寬
                        this.yMetadata.set('projectData', projSync);
                    }
                } else {
                    // 我是尚未拿到資料的純訪客，監聽雲端資料庫
                    const checkSync = () => {
                        const projSync = this.yMetadata.get('projectData');
                        if (projSync) {
                            this.eventBus.emit('COLLAB:SNAPSHOT_RECEIVED', {
                                projectData: projSync,
                                projectId: projSync.id
                            });
                        }
                    };
                    this.yMetadata.observe(checkSync);
                    checkSync(); // 初次連線立即檢查一次
                }
            });
        }

        // 若當前已處於登入狀態，立即處理 Deep Link
        const isAuthed = Boolean(localStorage.getItem('editorv2_current_user') || sessionStorage.getItem('editorv2_current_user'));
        if (isAuthed) {
            this.handleInitialRouting();
        }
    }

    /**
     * 處理初始 URL 路由與跨瀏覽器專案快照握手同步
     */
    async handleInitialRouting() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('project') || urlParams.get('projectId');
        const urlRoomId = urlParams.get('room') || urlParams.get('roomId');
        if (!urlProjectId) return;

        const targetProject = await this.storageEngine.getProject(urlProjectId);
        if (targetProject) {
            console.log(`[DashboardManager] Deep Linking 直通專案: ${targetProject.name} (${targetProject.id})`);
            await this.openProject(targetProject.id, false);
            if (this.eventBus) {
                const isGuest = targetProject.isShared === true;
                this.eventBus.emit('COLLAB:CONNECT_ROOM', { projectId: targetProject.id, roomId: urlRoomId || targetProject.id, isGuest: isGuest });
            }
            return;
        }

        console.log(`[DashboardManager] 本地資料庫查無專案 ${urlProjectId}，啟動房間握手同步...`);
        this.eventBus.emit('LOADING:START', { message: '正在連線協作房間，向雲端同步專案資料中...\n(若免費伺服器休眠中，喚醒約需等待 1 分鐘，請稍候)' });

        // 連線協作房間並請求快照 (isGuest: true)
        this.eventBus.emit('COLLAB:CONNECT_ROOM', {
            projectId: urlProjectId,
            roomId: urlRoomId || urlProjectId,
            isGuest: true
        });

        let syncCompleted = false;
        const syncTimeout = setTimeout(() => {
            if (!syncCompleted) {
                this.eventBus.emit('LOADING:END');
                alert('無法取得專案資料（可能因連線不穩定或免費伺服器喚醒失敗），已為您返回專案儀表板。');
                if (this.eventBus) {
                    this.eventBus.emit('ROUTER:NAVIGATE_DASHBOARD', { replace: true });
                }
            }
        }, 60000);

        this.eventBus.on('COLLAB:SNAPSHOT_RECEIVED', async (data) => {
            if (data && data.projectData && (data.projectId === urlProjectId || data.projectData.id === urlProjectId)) {
                syncCompleted = true;
                clearTimeout(syncTimeout);
                console.log(`[DashboardManager] 專案快照同步接收成功: ${data.projectData.name}`);

                // 標記這是一個與他人共編的專案
                data.projectData.isShared = true;

                // 寫入本地 IndexedDB 並開啟
                await this.storageEngine.saveProject(data.projectData);
                await this.loadProjects();
                await this.openProject(data.projectData.id, false);

                this.eventBus.emit('LOADING:END');
                this.showAutoSaveFeedback('專案資料同步完成，已加入協作！');
            }
        });
    }

    /**
     * 顯示 Dashboard 覆蓋層（供登入成功或登出後呼叫）
     */
    showDashboard() {
        if (!this.dashboardContainer) return;
        this.dashboardContainer.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        this.dashboardContainer.style.display = '';
        this.loadProjects();
    }

    createDashboardDOM() {
        this.editorContainer = document.getElementById('editor-view-container');
        
        // 建立 Dashboard 頂層容器
        this.dashboardContainer = document.createElement('div');
        this.dashboardContainer.id = 'dashboard-view';
        this.dashboardContainer.className = 'fixed inset-0 z-[60] bg-slate-50 flex flex-col overflow-y-auto custom-scrollbar transition-opacity duration-300';
        
        this.dashboardContainer.innerHTML = `
            <!-- Dashboard Header -->
            <header class="relative z-40 bg-white border-b-2 border-slate-700 shrink-0 shadow-sm overflow-hidden">
                <!-- 主要行：Logo / 標題 + 右側頭像 (永遠顯示) -->
                <div class="flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 gap-3">
                    <!-- 左：圖示 + 標題 (永遠顯示) -->
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                        <div class="sketch flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 text-slate-800 text-lg sm:text-xl font-black shadow-[2px_2px_0px_#334155] bg-amber-100 shrink-0">
                            <i class="fas fa-cubes"></i>
                        </div>
                        <div class="min-w-0 flex flex-col justify-center">
                            <div class="flex items-center gap-2">
                                <h1 class="text-sm sm:text-xl font-black text-slate-800 tracking-wide whitespace-nowrap truncate">專案儀表板</h1>
                                <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 whitespace-nowrap hidden sm:inline shrink-0">v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.5.0'}</span>
                            </div>
                            <p class="hidden lg:block text-xs text-slate-500 font-medium truncate mt-0.5">隨時管理、複製、刪除或開啟您的多媒體專案</p>
                        </div>
                    </div>

                    <!-- 右：搜尋 + 按鈕群 + 使用者頭像 (頭像永遠顯示) -->
                    <div id="dashboard-header-right" class="flex items-center gap-2 sm:gap-3 shrink-0">
                        <!-- 搜尋列：lg以下隱藏（移至第二行） -->
                        <div class="relative items-center hidden lg:flex">
                            <i class="fas fa-search absolute left-3 text-slate-400 text-xs pointer-events-none"></i>
                            <input type="text" id="dashboard-search-input" class="w-28 md:w-48 lg:w-60 bg-slate-100 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:w-40 md:focus:w-56 transition-all duration-200" placeholder="搜尋專案...">
                        </div>

                        <!-- 刪除已選按鈕 (預設隱藏) -->
                        <button id="btn-delete-selected" class="hidden sketch-btn px-2 sm:px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 flex items-center gap-1.5 shadow-[1.5px_1.5px_0px_#334155] shrink-0">
                            <i class="fas fa-trash-alt text-sm"></i>
                            <span class="hidden md:inline">刪除已選 (0)</span>
                        </button>

                        <!-- 批次選取按鈕 -->
                        <button id="btn-toggle-selection-mode" class="sketch-btn px-2 sm:px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-[1.5px_1.5px_0px_#334155] shrink-0" title="批次刪除專案">
                            <i class="fas fa-check-square text-indigo-600 text-sm"></i>
                            <span class="hidden md:inline">批次選取</span>
                        </button>

                        <!-- 匯入按鈕 -->
                        <button id="btn-import-project-file" class="sketch-btn px-2 sm:px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-[1.5px_1.5px_0px_#334155] shrink-0" title="匯入 .editorproj 專案檔、JSON、PDF、簡報或圖片">
                            <i class="fas fa-file-import text-teal-600 text-sm"></i>
                            <span class="hidden md:inline">匯入檔案</span>
                        </button>
                        <input type="file" id="input-project-file" accept=".editorproj,.json,.pdf,.ppt,.pptx,image/*" class="hidden">

                        <!-- 新建按鈕 -->
                        <button id="btn-open-create-modal" class="sketch-btn px-2 sm:px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 shadow-[2px_2px_0px_#334155] shrink-0 whitespace-nowrap">
                            <i class="fas fa-plus text-sm"></i>
                            <span class="hidden sm:inline">新建專案</span>
                        </button>

                        <!-- 使用者頭像 (永遠顯示在最右側，由 AuthManager 注入) -->
                        <div id="dashboard-user-profile-widget" class="relative shrink-0"></div>
                    </div>
                </div>

                <!-- 次要行：lg以下顯示搜尋列 -->
                <div class="flex lg:hidden px-4 pb-3 gap-2">
                    <div class="relative flex-1">
                        <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                        <input type="text" id="dashboard-search-input-mobile" class="w-full bg-slate-100 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition" placeholder="搜尋專案...">
                    </div>
                </div>
            </header>

            <!-- Dashboard Body -->
            <main class="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col space-y-4 sm:space-y-6">
                <!-- 篩選標籤列 -->
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 sm:pb-4">
                    <div class="flex items-center flex-wrap gap-2">
                        <button data-filter="ALL" class="dashboard-filter-btn px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 text-white shadow-sm transition">
                            全部專案 (<span id="count-all">0</span>)
                        </button>
                        <button data-filter="PDF" class="dashboard-filter-btn px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition">
                            📊 PPT / PDF 簡報 (<span id="count-pdf">0</span>)
                        </button>
                        <button data-filter="IMAGE" class="dashboard-filter-btn px-3.5 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition">
                            🖼️ 圖片專案 (<span id="count-image">0</span>)
                        </button>
                    </div>

                    <div class="text-[11px] sm:text-xs text-slate-500 flex items-center">
                        <i class="fas fa-database mr-1.5 text-indigo-500"></i> IndexedDB 本機安全保存
                    </div>
                </div>

                <!-- 專案卡片網格 -->
                <div id="projects-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    <!-- Cards will be dynamically injected here -->
                </div>

                <!-- 空專案提示 -->
                <div id="empty-projects-placeholder" class="hidden flex-1 flex flex-col items-center justify-center py-16 text-center">
                    <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 text-3xl mb-4">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <h3 class="text-lg font-bold text-slate-700 mb-1">找不到相關專案</h3>
                    <p class="text-sm text-slate-400 mb-6">點擊上方按鈕建立新專案或匯入現有專案檔</p>
                    <button id="btn-empty-create" class="sketch-btn px-5 py-2.5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-[2px_2px_0px_#334155]">
                        <i class="fas fa-plus mr-2"></i> 立即新建專案
                    </button>
                </div>
            </main>

            <!-- 建立新專案彈窗 (Modal) -->
            <div id="modal-create-project" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
                <div class="bg-white rounded-3xl p-5 sm:p-7 max-w-2xl w-full border-2 border-slate-700 shadow-[6px_6px_0px_#334155] space-y-5 max-h-[90vh] overflow-y-auto">
                    <div class="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg shrink-0">
                                <i class="fas fa-magic"></i>
                            </div>
                            <div>
                                <h3 class="text-lg sm:text-xl font-bold text-slate-800">新建專案與模板</h3>
                                <p class="text-xs text-slate-500">選擇最適合您創作情境的畫布尺寸與精選排版模板</p>
                            </div>
                        </div>
                        <button id="btn-close-create-modal" class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition shrink-0">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">專案名稱</label>
                            <input type="text" id="input-new-project-name" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" placeholder="例如：2026 商業企劃提案" value="未命名專案">
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">精選排版與尺寸模板</label>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3" id="template-options-container">
                                <!-- 模板 1: 圖片 16:9 -->
                                <div data-template="image_16_9" class="template-card border-2 border-indigo-600 bg-indigo-50/50 rounded-2xl p-3.5 cursor-pointer hover:border-indigo-600 transition flex items-center space-x-3">
                                    <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                                        <i class="fas fa-image"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                            <span>圖片 (16:9)</span>
                                            <span class="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.2 rounded font-bold">推薦</span>
                                        </div>
                                        <div class="text-xs text-slate-500">1280 × 720 · 橫幅設計</div>
                                    </div>
                                </div>

                                <!-- 模板 2: 圖片 4:3 -->
                                <div data-template="image_4_3" class="template-card border-2 border-slate-200 bg-white rounded-2xl p-3.5 cursor-pointer hover:border-indigo-500 transition flex items-center space-x-3">
                                    <div class="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center text-xl shrink-0">
                                        <i class="fas fa-desktop"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-bold text-sm text-slate-800">圖片 (4:3)</div>
                                        <div class="text-xs text-slate-500">1024 × 768 · 經典顯示</div>
                                    </div>
                                </div>

                                <!-- 模板 3: PPT -->
                                <div data-template="pdf_16_9" class="template-card border-2 border-slate-200 bg-white rounded-2xl p-3.5 cursor-pointer hover:border-indigo-500 transition flex items-center space-x-3">
                                    <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl shrink-0">
                                        <i class="fas fa-file-powerpoint"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-bold text-sm text-slate-800">PPT 簡報 (16:9)</div>
                                        <div class="text-xs text-slate-500">1280 × 720 · 多頁簡報</div>
                                    </div>
                                </div>

                                <!-- 模板 4: PDF -->
                                <div data-template="pdf_a4" class="template-card border-2 border-slate-200 bg-white rounded-2xl p-3.5 cursor-pointer hover:border-indigo-500 transition flex items-center space-x-3">
                                    <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl shrink-0">
                                        <i class="fas fa-file-pdf"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <div class="font-bold text-sm text-slate-800">PDF 文件 (A4)</div>
                                        <div class="text-xs text-slate-500">794 × 1123 · 直式文件</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                        <button id="btn-cancel-create-modal" class="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition">
                            取消
                        </button>
                        <button id="btn-confirm-create-project" class="sketch-btn px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-[2px_2px_0px_#334155]">
                            建立並進入編輯
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.dashboardContainer);

        if (this.eventBus) {
            this.eventBus.emit('DASHBOARD:READY');
        }

        // 綁定 Header 控制項目 (首頁按鈕、專案標題與自動儲存指示器)
        this.initHeaderControls();
    }

    initHeaderControls() {
        const btnHome = document.getElementById('btn-back-to-dashboard');
        if (btnHome) {
            btnHome.addEventListener('click', () => {
                this.closeProjectToDashboard();
            });
        }

        const titleDisplay = document.getElementById('current-project-title-display');
        const titleInput = document.getElementById('current-project-title-input');

        if (titleDisplay && titleInput) {
            titleDisplay.addEventListener('click', () => {
                titleInput.value = titleDisplay.textContent.trim();
                titleDisplay.classList.add('hidden');
                titleInput.classList.remove('hidden');
                titleInput.focus();
                titleInput.select();
            });

            const saveTitle = async () => {
                const newTitle = titleInput.value.trim() || '未命名專案';
                titleDisplay.textContent = newTitle;
                titleInput.classList.add('hidden');
                titleDisplay.classList.remove('hidden');

                if (this.currentProjectId) {
                    await this.storageEngine.renameProject(this.currentProjectId, newTitle);
                    this.showAutoSaveFeedback('已更新標題');
                }
            };

            titleInput.addEventListener('blur', saveTitle);
            titleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveTitle();
            });
        }
    }

    bindEvents() {
        // EventBus 路由與協作事件監聽
        if (this.eventBus) {
            this.eventBus.on('ROUTER:PROJECT_CHANGED', async (data) => {
                if (!data || !data.projectId) return;
                if (this.currentProjectId !== data.projectId) {
                    await this.openProject(data.projectId, false);
                }
            });

            this.eventBus.on('ROUTER:DASHBOARD_REQUESTED', async () => {
                if (this.currentProjectId) {
                    await this.closeProjectToDashboard(false);
                } else {
                    this.showDashboard();
                }
            });

            // 收到其他協作者/新分頁的專案同步請求 (Host 回傳快照)
            this.eventBus.on('COLLAB:SYNC_REQUEST_RECEIVED', async (req) => {
                const targetId = (req && req.projectId) ? req.projectId : this.currentProjectId;
                if (targetId) {
                    // 若請求的正是當前開啟的專案，強制先儲存最新狀態，以確保訪客拿到最新的模式與畫布
                    if (targetId === this.currentProjectId) {
                        await this.saveCurrentProjectNow();
                    }
                    const proj = await this.storageEngine.getProject(targetId);
                    if (proj) {
                        console.log(`[DashboardManager] 房主收到同步請求，正在回傳專案 ${proj.name} 快照至通道...`);
                        this.eventBus.emit('COLLAB:SEND_SNAPSHOT', { projectData: proj });
                    }
                }
            });
        }

        // 批次選取按鈕
        const btnToggleSelection = document.getElementById('btn-toggle-selection-mode');
        if (btnToggleSelection) {
            btnToggleSelection.addEventListener('click', () => {
                this.isSelectionMode = !this.isSelectionMode;
                this.selectedProjectIds.clear();
                
                const span = btnToggleSelection.querySelector('span');
                if (span) span.textContent = this.isSelectionMode ? '取消選取' : '批次選取';
                
                if (this.isSelectionMode) {
                    btnToggleSelection.classList.add('bg-slate-200');
                    btnToggleSelection.classList.remove('hover:bg-slate-50');
                } else {
                    btnToggleSelection.classList.remove('bg-slate-200');
                    btnToggleSelection.classList.add('hover:bg-slate-50');
                }
                
                this.renderProjectCards();
                this.updateBatchActionUI();
            });
        }

        // 刪除已選按鈕
        const btnDeleteSelected = document.getElementById('btn-delete-selected');
        if (btnDeleteSelected) {
            btnDeleteSelected.addEventListener('click', async () => {
                if (this.selectedProjectIds.size === 0) return;
                if (confirm(`確定要刪除選取的 ${this.selectedProjectIds.size} 個專案嗎？此動作無法復原。`)) {
                    this.eventBus.emit('LOADING:START', { message: '正在刪除專案...' });
                    try {
                        const deletePromises = Array.from(this.selectedProjectIds).map(id => this.storageEngine.deleteProject(id));
                        await Promise.all(deletePromises);
                        this.selectedProjectIds.clear();
                        this.isSelectionMode = false;
                        
                        if (btnToggleSelection) {
                            const span = btnToggleSelection.querySelector('span');
                            if (span) span.textContent = '批次選取';
                            btnToggleSelection.classList.remove('bg-slate-200');
                            btnToggleSelection.classList.add('hover:bg-slate-50');
                        }
                        
                        await this.loadProjects();
                        this.updateBatchActionUI();
                    } catch (err) {
                        console.error('[DashboardManager] 批次刪除失敗', err);
                        alert('刪除過程中發生錯誤：' + err.message);
                    } finally {
                        this.eventBus.emit('LOADING:END');
                    }
                }
            });
        }

        // 搜尋（桌面 + 行動版同步）
        const searchHandler = (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            // 同步另一個搜尋欄的值
            const desktop = document.getElementById('dashboard-search-input');
            const mobile = document.getElementById('dashboard-search-input-mobile');
            if (desktop && e.target !== desktop) desktop.value = e.target.value;
            if (mobile && e.target !== mobile) mobile.value = e.target.value;
            this.renderProjectCards();
        };
        const searchInput = document.getElementById('dashboard-search-input');
        if (searchInput) searchInput.addEventListener('input', searchHandler);
        const searchInputMobile = document.getElementById('dashboard-search-input-mobile');
        if (searchInputMobile) searchInputMobile.addEventListener('input', searchHandler);

        // 篩選按鈕
        const filterBtns = this.dashboardContainer.querySelectorAll('.dashboard-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => {
                    b.classList.remove('bg-indigo-600', 'text-white');
                    b.classList.add('bg-slate-200', 'text-slate-700');
                });
                btn.classList.remove('bg-slate-200', 'text-slate-700');
                btn.classList.add('bg-indigo-600', 'text-white');

                this.currentFilter = btn.dataset.filter;
                this.renderProjectCards();
            });
        });

        // 彈窗開關
        const btnOpenCreate = document.getElementById('btn-open-create-modal');
        const btnEmptyCreate = document.getElementById('btn-empty-create');
        const btnCloseCreate = document.getElementById('btn-close-create-modal');
        const btnCancelCreate = document.getElementById('btn-cancel-create-modal');
        const modalCreate = document.getElementById('modal-create-project');

        const openModal = () => {
            if (modalCreate) {
                modalCreate.classList.remove('hidden');
                const nameInput = document.getElementById('input-new-project-name');
                if (nameInput) {
                    nameInput.value = `專案 ${new Date().toLocaleDateString('zh-TW')} ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
                    nameInput.focus();
                }
            }
        };

        const closeModal = () => {
            if (modalCreate) modalCreate.classList.add('hidden');
        };

        if (btnOpenCreate) btnOpenCreate.addEventListener('click', openModal);
        if (btnEmptyCreate) btnEmptyCreate.addEventListener('click', openModal);
        if (btnCloseCreate) btnCloseCreate.addEventListener('click', closeModal);
        if (btnCancelCreate) btnCancelCreate.addEventListener('click', closeModal);

        // 選擇模板卡片
        let selectedTemplate = 'image_16_9';
        const templateCards = this.dashboardContainer.querySelectorAll('.template-card');
        templateCards.forEach(card => {
            card.addEventListener('click', () => {
                templateCards.forEach(c => {
                    c.classList.remove('border-indigo-600', 'bg-indigo-50/50');
                    c.classList.add('border-slate-200', 'bg-white');
                });
                card.classList.remove('border-slate-200', 'bg-white');
                card.classList.add('border-indigo-600', 'bg-indigo-50/50');
                selectedTemplate = card.dataset.template;
            });
        });

        // 確認建立專案
        const btnConfirmCreate = document.getElementById('btn-confirm-create-project');
        if (btnConfirmCreate) {
            btnConfirmCreate.addEventListener('click', async () => {
                const nameInput = document.getElementById('input-new-project-name');
                const name = nameInput ? nameInput.value.trim() || '未命名專案' : '未命名專案';

                let options = { name, type: 'IMAGE', width: 1280, height: 720, ratio: '16:9', template: 'image_16_9' };

                if (selectedTemplate === 'image_16_9') {
                    options = { name, type: 'IMAGE', width: 1280, height: 720, ratio: '16:9', template: 'image_16_9' };
                } else if (selectedTemplate === 'image_4_3') {
                    options = { name, type: 'IMAGE', width: 1024, height: 768, ratio: '4:3', template: 'image_4_3' };
                } else if (selectedTemplate === 'pdf_16_9') {
                    options = { name, type: 'PDF', width: 1280, height: 720, ratio: '16:9', template: 'pdf_16_9' };
                } else if (selectedTemplate === 'pdf_a4') {
                    options = { name, type: 'PDF', width: 794, height: 1123, ratio: 'A4', template: 'pdf_a4' };
                }

                closeModal();
                const newProject = await this.storageEngine.createBlankProject(options);
                await this.loadProjects();
                await this.openProject(newProject.id);
            });
        }

        // 匯入檔案按鈕 (支援 .editorproj, .json, .pdf, 圖片, .pptx)
        const btnImportFile = document.getElementById('btn-import-project-file');
        const inputProjectFile = document.getElementById('input-project-file');

        if (btnImportFile && inputProjectFile) {
            btnImportFile.addEventListener('click', () => inputProjectFile.click());
            inputProjectFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const fileName = file.name.toLowerCase();
                const fileType = file.type;

                try {
                    if (fileName.endsWith('.editorproj') || fileName.endsWith('.json') || fileType === 'application/json') {
                        this.eventBus.emit('LOADING:START', { message: '正在匯入專案檔案...' });
                        const importedProj = await this.storageEngine.importProjectFile(file);
                        await this.loadProjects();
                        await this.openProject(importedProj.id);
                    } else if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
                        this.eventBus.emit('LOADING:START', { message: '正在解析並建立 PDF 專案...' });
                        await this.importPDFAsNewProject(file);
                    } else if (fileType.startsWith('image/')) {
                        this.eventBus.emit('LOADING:START', { message: '正在匯入圖片建立新專案...' });
                        await this.importImageAsNewProject(file);
                    } else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
                        this.eventBus.emit('LOADING:START', { message: '正在轉換簡報並建立專案...' });
                        await this.importPPTAsNewProject(file);
                    } else {
                        alert('不支援的檔案格式！請選擇 .editorproj, .json, .pdf, .pptx 或圖片檔案。');
                    }
                } catch (err) {
                    console.error('[DashboardManager] 匯入失敗:', err);
                    alert('匯入失敗: ' + err.message);
                } finally {
                    this.eventBus.emit('LOADING:END');
                    inputProjectFile.value = '';
                }
            });
        }
    }

    async loadProjects() {
        this.projects = await this.storageEngine.getAllProjects();
        // 自動修復曾被誤設為 IMAGE 的簡報預設專案，並清除舊版含黑邊的 JPEG 縮圖快取
        for (const p of this.projects) {
            let changed = false;
            if (p.name && p.name.includes('簡報') && p.type === 'IMAGE') {
                p.type = 'PDF';
                changed = true;
            }
            if (p.coverThumbnail && p.coverThumbnail.startsWith('data:image/jpeg')) {
                p.coverThumbnail = null;
                changed = true;
            }
            if (changed) {
                await this.storageEngine.saveProject(p);
            }
        }
        this.updateCounts();
        this.renderProjectCards();
    }

    updateCounts() {
        const countAll = document.getElementById('count-all');
        const countPdf = document.getElementById('count-pdf');
        const countImage = document.getElementById('count-image');

        if (countAll) countAll.textContent = this.projects.length;
        if (countPdf) countPdf.textContent = this.projects.filter(p => p.type === 'PDF').length;
        if (countImage) countImage.textContent = this.projects.filter(p => p.type === 'IMAGE').length;
    }

    updateBatchActionUI() {
        const btnDeleteSelected = document.getElementById('btn-delete-selected');
        if (!btnDeleteSelected) return;

        if (this.isSelectionMode && this.selectedProjectIds.size > 0) {
            btnDeleteSelected.classList.remove('hidden');
            const span = btnDeleteSelected.querySelector('span');
            if (span) span.textContent = `刪除已選 (${this.selectedProjectIds.size})`;
        } else {
            btnDeleteSelected.classList.add('hidden');
        }
    }

    renderProjectCards() {
        const grid = document.getElementById('projects-grid');
        const emptyPlaceholder = document.getElementById('empty-projects-placeholder');
        if (!grid || !emptyPlaceholder) return;

        let filtered = this.projects;

        if (this.currentFilter !== 'ALL') {
            filtered = filtered.filter(p => p.type === this.currentFilter);
        }

        if (this.searchQuery) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(this.searchQuery));
        }

        if (filtered.length === 0) {
            grid.innerHTML = '';
            emptyPlaceholder.classList.remove('hidden');
            return;
        }

        emptyPlaceholder.classList.add('hidden');
        grid.innerHTML = '';

        filtered.forEach(proj => {
            const isSelected = this.selectedProjectIds.has(proj.id);

            const card = document.createElement('div');
            card.className = `project-card bg-white rounded-2xl border-2 overflow-hidden flex flex-col transition-all duration-200 cursor-pointer relative group ${
                isSelected 
                ? 'border-indigo-600 shadow-[5px_5px_0px_#4f46e5] -translate-y-1 ring-2 ring-indigo-600 ring-offset-2 ring-offset-slate-50' 
                : 'border-slate-700 shadow-[3px_3px_0px_#334155] hover:shadow-[5px_5px_0px_#334155] hover:-translate-y-1'
            }`;
            card.dataset.id = proj.id;

            const timeStr = new Date(proj.updatedAt || proj.createdAt).toLocaleString('zh-TW', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const isPdf = proj.type === 'PDF';
            const pageCount = (proj.pages && proj.pages.length) ? proj.pages.length : Object.keys(proj.pageStates || {}).length || 1;

            // 確保縮圖優先呈現第 1 頁 (即使曾暫存於其他頁面)
            let coverSrc = proj.coverThumbnail;
            if (!coverSrc && proj.pages && proj.pages.length > 0 && proj.pages[0].thumbnail) {
                coverSrc = proj.pages[0].thumbnail;
            }
            if (!coverSrc && proj.pageStates) {
                const pids = Object.keys(proj.pageStates);
                if (pids.length > 0 && Array.isArray(proj.pageStates[pids[0]])) {
                    const bgObj = proj.pageStates[pids[0]].find(o => o.type === 'image' && o.src);
                    if (bgObj && bgObj.src) coverSrc = bgObj.src;
                }
            }

            const thumbnailContent = coverSrc
                ? `<div class="w-full h-full flex items-center justify-center p-3">
                     <img src="${coverSrc}" class="max-h-full max-w-full object-contain rounded-md shadow-sm border border-slate-300/80 bg-white" alt="${proj.name}">
                   </div>`
                : `<div class="w-full h-full flex items-center justify-center p-3">
                     <div class="w-28 h-20 rounded-md border border-slate-300/80 bg-white shadow-sm flex flex-col items-center justify-center text-slate-400">
                         <i class="fas ${isPdf ? 'fa-file-powerpoint' : 'fa-image'} text-2xl mb-1 text-slate-300"></i>
                         <span class="text-[10px] font-bold text-slate-400">${isPdf ? '簡報畫布' : '圖片畫布'}</span>
                     </div>
                   </div>`;

            card.innerHTML = `
                <!-- 縮圖區 -->
                <div class="project-card-thumbnail h-44 bg-slate-100/90 border-b-2 ${isSelected ? 'border-indigo-100' : 'border-slate-700'} relative overflow-hidden flex items-center justify-center group-hover:bg-slate-200/60 transition select-none">
                    ${thumbnailContent}
                    ${this.isSelectionMode ? `
                    <div class="absolute inset-0 z-10 flex items-start justify-end p-3 pointer-events-none">
                         <div class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shadow-sm ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400 bg-white/90 text-transparent group-hover:border-indigo-400'}">
                             <i class="fas fa-check text-xs"></i>
                         </div>
                    </div>` : ''}
                    
                    ${!this.isSelectionMode ? `
                    <div class="absolute top-3 left-3 flex items-center space-x-1.5 z-20">
                        <span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${isPdf ? 'bg-indigo-600 text-white' : 'bg-teal-600 text-white'} shadow-sm">
                            ${isPdf ? '📊 簡報/PDF' : '🖼️ 圖片'}
                        </span>
                        ${isPdf ? `<span class="project-page-badge px-2 py-1 rounded-lg text-[10px] font-bold bg-white/90 text-slate-700 border border-slate-300 shadow-sm">${pageCount} 頁</span>` : ''}
                    </div>

                    ` : ''}
                </div>

                <!-- 操作按鈕選單觸發 (移出 thumbnail 以免被 overflow-hidden 裁切) -->
                ${!this.isSelectionMode ? `
                <div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition z-30">
                    <div class="relative dropdown-container">
                        <button class="btn-card-menu w-8 h-8 rounded-xl bg-white/90 border border-slate-300 hover:bg-white text-slate-700 flex items-center justify-center shadow-sm">
                            <i class="fas fa-ellipsis-v text-xs"></i>
                        </button>
                        <div class="card-dropdown hidden absolute right-0 mt-1 w-36 bg-white border-2 border-slate-700 rounded-xl shadow-[3px_3px_0px_#334155] py-1.5 z-40 text-xs">
                            <button class="btn-card-rename w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-slate-700 font-bold flex items-center">
                                <i class="fas fa-pencil-alt mr-2 text-indigo-500"></i> 重命名
                            </button>
                            <button class="btn-card-duplicate w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-slate-700 font-bold flex items-center">
                                <i class="fas fa-copy mr-2 text-teal-500"></i> 建立副本
                            </button>
                            <button class="btn-card-export w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-slate-700 font-bold flex items-center">
                                <i class="fas fa-download mr-2 text-blue-500"></i> 匯出專案
                            </button>
                            <div class="border-t border-slate-200 my-1"></div>
                            <button class="btn-card-delete w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 font-bold flex items-center">
                                <i class="fas fa-trash-alt mr-2"></i> 刪除專案
                            </button>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- 資訊區 -->
                <div class="project-card-info p-4 flex flex-col justify-between flex-1 ${isSelected ? 'bg-indigo-50' : 'bg-white'}">
                    <div>
                        <h4 class="project-card-title font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-800'} truncate mb-1" title="${proj.name}">${proj.name}</h4>
                        <div class="project-card-date text-[11px] ${isSelected ? 'text-indigo-400' : 'text-slate-400'} flex items-center">
                            <i class="far fa-clock mr-1.5"></i> ${timeStr}
                        </div>
                    </div>
                </div>
            `;

            // 點擊卡片開啟專案
            card.addEventListener('click', (e) => {
                if (e.target.closest('.dropdown-container')) return;
                
                if (this.isSelectionMode) {
                    if (this.selectedProjectIds.has(proj.id)) {
                        this.selectedProjectIds.delete(proj.id);
                    } else {
                        this.selectedProjectIds.add(proj.id);
                    }
                    this.renderProjectCards();
                    this.updateBatchActionUI();
                } else {
                    this.openProject(proj.id);
                }
            });

            // 綁定卡片右上方選單
            const menuBtn = card.querySelector('.btn-card-menu');
            const dropdown = card.querySelector('.card-dropdown');

            if (menuBtn && dropdown) {
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 關閉其他已開啟的選單
                    document.querySelectorAll('.card-dropdown').forEach(d => {
                        if (d !== dropdown) d.classList.add('hidden');
                    });
                    dropdown.classList.toggle('hidden');
                });

                // 重命名
                card.querySelector('.btn-card-rename').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.classList.add('hidden');
                    const newName = prompt('請輸入新的專案名稱：', proj.name);
                    if (newName && newName.trim() && newName.trim() !== proj.name) {
                        await this.storageEngine.renameProject(proj.id, newName.trim());
                        await this.loadProjects();
                    }
                });

                // 複製副本
                card.querySelector('.btn-card-duplicate').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.classList.add('hidden');
                    await this.storageEngine.duplicateProject(proj.id);
                    await this.loadProjects();
                });

                // 匯出專案檔
                card.querySelector('.btn-card-export').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.classList.add('hidden');
                    await this.storageEngine.exportProjectFile(proj.id);
                });

                // 刪除專案
                card.querySelector('.btn-card-delete').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    dropdown.classList.add('hidden');
                    if (confirm(`確定要刪除專案「${proj.name}」嗎？此動作無法復原。`)) {
                        await this.storageEngine.deleteProject(proj.id);
                        await this.loadProjects();
                    }
                });
            }

            grid.appendChild(card);
        });

        // 點擊外部關閉所有 dropdown
        document.addEventListener('click', () => {
            document.querySelectorAll('.card-dropdown').forEach(d => d.classList.add('hidden'));
        });
    }

    /**
     * 開啟特定專案進入編輯器
     */
    async openProject(projectId, updateRouter = true) {
        try {
            const project = await this.storageEngine.getProject(projectId);
        if (!project) {
            alert('專案不存在或已被移除');
            return;
        }

        this.currentProjectId = project.id;
        console.log(`[DashboardManager] 開啟專案: ${project.name} (${project.id})`);

        // ★ 動態判定權限 (Canva 模式)
        const currentUser = this.storageEngine.authManager ? this.storageEngine.authManager.getCurrentUser() : null;
        const currentUserId = currentUser ? currentUser.id : 'unknown';
        const isOwner = project.ownerId === currentUserId;
        
        const urlParams = new URLSearchParams(window.location.search);
        const urlRole = urlParams.get('role');
        
        // 只要不是擁有者，且網址指定 viewer，就鎖定為檢視模式 (不再特權放行系統 admin)
        if (!isOwner && urlRole === 'viewer') {
            document.body.classList.add('viewer-mode');
        } else {
            document.body.classList.remove('viewer-mode');
        }

        // 推送專案 URL 路由並連線協作通道
        if (updateRouter && this.eventBus) {
            const urlParams = new URLSearchParams(window.location.search);
            const roomId = urlParams.get('room') || null;
            this.eventBus.emit('ROUTER:NAVIGATE_PROJECT', { projectId: project.id, roomId });
        }
        if (this.eventBus) {
            const urlParams = new URLSearchParams(window.location.search);
            const roomId = urlParams.get('room') || null;
            // 根據專案的 isShared 屬性來判斷是否為客端
            const isGuest = project.isShared === true;
            this.eventBus.emit('COLLAB:CONNECT_ROOM', { projectId: project.id, roomId: roomId || project.id, isGuest: isGuest, isOwner: isOwner });
        }

        // 更新 Header 專案標題
        const titleDisplay = document.getElementById('current-project-title-display');
        if (titleDisplay) {
            titleDisplay.textContent = project.name;
        }

        // 切換工作區模式 (IMAGE / PDF)，傳入 force=true 避免無謂未儲存提示
        if (this.workspaceManager) {
            this.workspaceManager.setDirty(false);
            this.workspaceManager.switchMode(project.type || 'PDF', true);
        }

        // 調整畫布底板尺寸
        const dim = project.dimension || { width: 1280, height: 720 };
        this.canvasEngine.resizeArtboard(dim.width, dim.height);

        // 載入專案 pageStates 與 pageSizes
        this.canvasEngine.pageStates = project.pageStates || {};
        this.canvasEngine.pageSizes = project.pageSizes || {};

        const pageIds = Object.keys(this.canvasEngine.pageStates);
        const activePageId = project.currentPageId || (pageIds.length > 0 ? pageIds[0] : 'page-1');

        if (!this.canvasEngine.pageStates[activePageId]) {
            this.canvasEngine.pageStates[activePageId] = [];
        }

        // 觸發專案載入事件，讓 ThumbnailsPanel 更新縮圖清單並傳遞已存在的頁面縮圖
        this.eventBus.emit('PROJECT:IMPORTED', {
            projectData: {
                pageStates: this.canvasEngine.pageStates,
                currentPageId: activePageId,
                pages: project.pages || []
            }
        });

        // 切換到活動頁面並還原畫布物件
        // 先將當前 ID 設為 null，避免 loadPageState 誤判需要先儲存當前的空畫布
        this.canvasEngine.currentPageId = null; 
        this.canvasEngine.loadPageState(activePageId, true);
        if (typeof this.canvasEngine.fitToScreen === 'function') {
            this.canvasEngine.fitToScreen();
        }

            // 隱藏 Dashboard，顯示 Editor
            this.dashboardContainer.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                this.dashboardContainer.classList.add('hidden');
                this.dashboardContainer.style.display = 'none';
            }, 300);

            this.showAutoSaveFeedback('專案載入完成');
        } catch (error) {
            alert("開啟專案發生錯誤: " + error.message + "\n" + error.stack);
            console.error("openProject error:", error);
        }
    }

    /**
     * 關閉編輯器並返回 Dashboard
     */
    async closeProjectToDashboard(updateRouter = true) {
        if (this.currentProjectId) {
            this.eventBus.emit('LOADING:START', { message: '正在儲存專案...' });
            try {
                await this.saveCurrentProjectNow();
            } catch (err) {
                console.error("saveCurrentProjectNow failed:", err);
            } finally {
                this.eventBus.emit('LOADING:END');
            }
        }

        this.currentProjectId = null;

        // 導航回儀表板首頁路由與中斷房間通道
        if (updateRouter && this.eventBus) {
            this.eventBus.emit('ROUTER:NAVIGATE_DASHBOARD');
        }
        if (this.eventBus) {
            this.eventBus.emit('COLLAB:DISCONNECT_ROOM');
        }

        // 重新載入列表
        await this.loadProjects();

        // 顯示 Dashboard
        this.dashboardContainer.classList.remove('hidden');
        this.dashboardContainer.style.display = '';
        setTimeout(() => {
            this.dashboardContainer.classList.remove('opacity-0', 'pointer-events-none');
        }, 10);
    }

    /**
     * 自動儲存引擎配置 (Debounce 800ms)
     */
    setupAutoSave() {
        let debounceTimer = null;
        this.isCollabMode = false;

        this.eventBus.on('COLLAB:CONNECT_ROOM', () => { this.isCollabMode = true; });
        this.eventBus.on('COLLAB:DISCONNECT_ROOM', () => { this.isCollabMode = false; });

        const triggerAutoSave = () => {
            if (!this.currentProjectId) return;
            if (this.isCollabMode) {
                // 共編模式下由 Firebase 接管，暫停 IndexedDB 寫入避免衝突
                return;
            }
            const indicator = document.getElementById('auto-save-indicator');
            if (indicator) {
                indicator.innerHTML = `<i class="fas fa-spinner fa-spin mr-1 text-indigo-500"></i> 正在儲存...`;
                indicator.className = 'text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 flex items-center';
            }

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                await this.saveCurrentProjectNow();
                this.showAutoSaveFeedback('已自動儲存');
            }, 800);
        };

        // 監聽畫布修改與髒標記事件
        this.eventBus.on('CANVAS:DIRTY', triggerAutoSave);
        this.eventBus.on('PAGE:SWITCH', triggerAutoSave);
        this.eventBus.on('PAGE:ADD', triggerAutoSave);
        this.eventBus.on('PAGE:DELETE', triggerAutoSave);
        this.eventBus.on('PAGE:COPY', triggerAutoSave);
        this.eventBus.on('WORKSPACE:MODE_CHANGED', triggerAutoSave);
    }

    /**
     * 立即將當前畫布與所有頁面完整寫入 IndexedDB
     */
    async saveCurrentProjectNow() {
        if (!this.currentProjectId) return;

        // 確保當前編輯頁面物件有寫入 pageStates
        this.canvasEngine.savePageState();

        const currentProj = await this.storageEngine.getProject(this.currentProjectId);
        if (!currentProj) return;

        // 產生居中乾淨的底板縮圖 (避免平移偏移與黑邊)
        let currentThumbnail = null;
        try {
            if (typeof this.canvasEngine.getArtboardThumbnailDataURL === 'function') {
                currentThumbnail = this.canvasEngine.getArtboardThumbnailDataURL(0.25);
            } else {
                currentThumbnail = this.canvasEngine.canvas.toDataURL({
                    format: 'jpeg',
                    quality: 0.6,
                    multiplier: 0.2
                });
            }
        } catch (e) {
            console.warn('[DashboardManager] 縮圖生成略過 (可能含跨域圖片)');
        }

        const pageIds = Object.keys(this.canvasEngine.pageStates || {});
        const firstPageId = pageIds[0] || 'page-1';
        const currentPageId = this.canvasEngine.currentPageId || firstPageId;
        const isEditingFirstPage = (currentPageId === firstPageId);

        // 專案卡片縮圖固定鎖定在「第 1 頁 (首頁)」：
        // 只有當前正在編輯第 1 頁、或專案原本無封面縮圖時，才更新 coverThumbnail
        if (currentThumbnail) {
            if (isEditingFirstPage || !currentProj.coverThumbnail) {
                currentProj.coverThumbnail = currentThumbnail;
            }
        }

        // 同步更新每一頁在 pages 陣列中的個別縮圖
        const updatedPages = (currentProj.pages || []).slice();
        pageIds.forEach((pid) => {
            let pageEntry = updatedPages.find(p => p.id === pid);
            if (!pageEntry) {
                pageEntry = { id: pid, active: pid === currentPageId, thumbnail: null };
                updatedPages.push(pageEntry);
            }
            if (pid === currentPageId && currentThumbnail) {
                pageEntry.thumbnail = currentThumbnail;
            }
            pageEntry.active = (pid === currentPageId);
        });

        // 若無封面縮圖但第 1 頁有縮圖，則指派第 1 頁為封面
        if (!currentProj.coverThumbnail && updatedPages.length > 0 && updatedPages[0].thumbnail) {
            currentProj.coverThumbnail = updatedPages[0].thumbnail;
        }

        currentProj.pages = updatedPages;
        currentProj.currentPageId = currentPageId;
        currentProj.pageStates = this.canvasEngine.pageStates;
        currentProj.pageSizes = this.canvasEngine.pageSizes || {};
        currentProj.type = this.workspaceManager ? this.workspaceManager.currentMode : (currentProj.type || 'PDF');
        currentProj.dimension = {
            width: this.canvasEngine.artboard ? this.canvasEngine.artboard.width : 1280,
            height: this.canvasEngine.artboard ? this.canvasEngine.artboard.height : 720
        };

        await this.storageEngine.saveProject(currentProj);
    }

    /**
     * 從 PDF 檔案建立新專案並開啟
     */
    async importPDFAsNewProject(file) {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;

        const pageStates = {};
        const pageIds = [];
        const thumbnails = {};
        const pageSizes = {};

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDocument.getPage(i);
            
            // 1. 產生畫布用高解析背景 (委派給 RetinaRenderer 模組)
            const bgResult = await RetinaRenderer.renderPageBackground(page);
            const highResDataUrl = bgResult.dataUrl;
            const bgWidth = bgResult.width;
            const bgHeight = bgResult.height;

            // 將高解析背景轉為 Blob 並上傳至 Firebase Storage
            const fetchRes = await fetch(highResDataUrl);
            const blob = await fetchRes.blob();
            
            this.eventBus.emit('LOADING:START', `上傳 PDF 第 ${i} 頁...`);
            let finalSrc = highResDataUrl;
            try {
                finalSrc = await FirebaseProvider.uploadAsset(blob, `pdf_page_${i}.jpg`);
            } catch (err) {
                console.error(`第 ${i} 頁上傳失敗，退回使用本地 Base64:`, err);
            }

            // 2. 產生縮圖 (縮圖保持本機小圖即可，不一定要上傳，或是也可上傳)
            const thumbDataUrl = await RetinaRenderer.renderPageThumbnail(page, 0.5, 0.8);

            const pageId = `page-${Date.now()}-${i}`;
            pageIds.push(pageId);
            thumbnails[pageId] = thumbDataUrl;
            pageSizes[pageId] = { width: bgWidth, height: bgHeight };

            pageStates[pageId] = [{
                type: 'image',
                version: '5.3.0',
                originX: 'center',
                originY: 'center',
                left: bgWidth / 2,
                top: bgHeight / 2,
                width: bgWidth,
                height: bgHeight,
                scaleX: 1,
                scaleY: 1,
                src: finalSrc,
                // crossOrigin: 'anonymous', // 移除以避免 Firebase CORS 政策導致圖片完全無法載入
                selectable: false,
                evented: false,
                hasControls: false,
                lockMovementX: true,
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                lockRotation: true,
                layerName: 'PDF 背景'
            }];
        }

        const baseName = file.name.replace(/\.pdf$/i, '');
        const firstSize = pageSizes[pageIds[0]] || { width: 1280, height: 720 };

        const newProject = {
            id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            name: baseName || '匯入 PDF 專案',
            type: 'PDF',
            dimension: {
                width: firstSize.width,
                height: firstSize.height,
                ratio: `${firstSize.width}:${firstSize.height}`
            },
            currentPageId: pageIds[0],
            coverThumbnail: thumbnails[pageIds[0]] || null,
            pageStates: pageStates,
            pageSizes: pageSizes,
            pages: pageIds.map((pid, idx) => ({ id: pid, active: idx === 0, thumbnail: thumbnails[pid] })),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: '1.2.1'
        };

        await this.storageEngine.saveProject(newProject);
        await this.loadProjects();
        await this.openProject(newProject.id);
    }

    /**
     * 從圖片建立新專案並開啟
     */
    async importImageAsNewProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                const img = new Image();
                img.onload = async () => {
                    try {
                        const width = img.naturalWidth || 1280;
                        const height = img.naturalHeight || 720;
                        const baseName = file.name.replace(/\.[^.]+$/, '');
                        const pageId = `page-${Date.now()}-1`;
                        
                        this.eventBus.emit('LOADING:START', '上傳圖片至雲端...');
                        let finalSrc = dataUrl;
                        try {
                            finalSrc = await FirebaseProvider.uploadAsset(file, file.name);
                        } catch (err) {
                            console.error('圖片上傳失敗，退回使用本地 Base64:', err);
                        }
                        this.eventBus.emit('LOADING:END');

                        const newProject = {
                            id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                            name: baseName || '匯入圖片專案',
                            type: 'IMAGE',
                            dimension: {
                                width: width,
                                height: height,
                                ratio: `${width}:${height}`
                            },
                            currentPageId: pageId,
                            coverThumbnail: dataUrl,
                            pageStates: {
                                [pageId]: [{
                                    type: 'image',
                                    version: '5.3.0',
                                    originX: 'center',
                                    originY: 'center',
                                    left: width / 2,
                                    top: height / 2,
                                    width: width,
                                    height: height,
                                    scaleX: 1,
                                    scaleY: 1,
                                    src: finalSrc,
                                    // crossOrigin: 'anonymous', // 移除以避免 Firebase CORS 政策導致圖片完全無法載入
                                    selectable: false,
                                    evented: false,
                                    hasControls: false,
                                    lockMovementX: true,
                                    lockMovementY: true,
                                    lockScalingX: true,
                                    lockScalingY: true,
                                    lockRotation: true,
                                    layerName: '背景圖片'
                                }]
                            },
                            pageSizes: {
                                [pageId]: { width, height }
                            },
                            pages: [{ id: pageId, active: true, thumbnail: dataUrl }],
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            version: '1.2.1'
                        };

                        await this.storageEngine.saveProject(newProject);
                        await this.loadProjects();
                        await this.openProject(newProject.id);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error('讀取圖片資訊失敗'));
                img.src = dataUrl;
            };
            reader.onerror = () => reject(new Error('讀取圖片檔案失敗'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * 從 PPT/PPTX 建立新專案並開啟
     */
    async importPPTAsNewProject(file) {
        let secret = '';
        let provider = 'convertapi';
        try {
            const vaultConfig = ApiVaultManager.getVaultConfig();
            provider = vaultConfig.pptParsing?.provider || 'convertapi';
            if (provider === 'gotenberg') {
                secret = vaultConfig.pptParsing?.gotenbergBaseUrl || 'http://localhost:3000';
            } else if (provider === 'cloudconvert') {
                secret = vaultConfig.pptParsing?.cloudconvertSecret || vaultConfig.pptParsing?.secret || '';
            } else {
                secret = vaultConfig.pptParsing?.secret || '';
            }
        } catch (e) {
            console.warn('Failed to parse vault config', e);
        }

        if (provider === 'convertapi') {
            await this._importPPTWithConvertAPI(file, secret);
        } else if (provider === 'cloudconvert') {
            await this._importPPTWithCloudConvert(file, secret);
        } else if (provider === 'gotenberg') {
            await this._importPPTWithGotenberg(file, secret);
        } else {
            throw new Error("未知的轉檔服務商: " + provider);
        }
    }

    async _importPPTWithConvertAPI(file, secret) {
        if (!secret) {
            try {
                const legacyVault = JSON.parse(localStorage.getItem('editor_api_vault') || '{}');
                secret = legacyVault.convertApiKey || localStorage.getItem('convertapi_secret') || (import.meta.env && import.meta.env.VITE_CONVERTAPI_SECRET) || '';
            } catch (e) {
                secret = (import.meta.env && import.meta.env.VITE_CONVERTAPI_SECRET) || '';
            }
        }
        if (!secret) throw new Error("未設定 ConvertAPI 金鑰（請至金鑰保險箱設定）");

        const formData = new FormData();
        formData.append('File', file);
        
        const ext = file.name.split('.').pop().toLowerCase();
        const format = (ext === 'pptx') ? 'pptx' : 'ppt';

        const response = await fetch(`https://v2.convertapi.com/convert/${format}/to/pdf?Secret=${secret}&StoreFile=false`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.Message || `API 回應錯誤 (${response.status})`);
        }

        const data = await response.json();
        
        if (data.Files && data.Files.length > 0 && data.Files[0].FileData) {
            const base64Data = data.Files[0].FileData;
            const binaryString = window.atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
            const pdfFile = new File([pdfBlob], file.name.replace(/\.pptx?$/i, '.pdf'), { type: 'application/pdf' });
            
            await this.importPDFAsNewProject(pdfFile);
        } else {
            throw new Error("API 未回傳有效的 PDF 資料");
        }
    }

    async _importPPTWithCloudConvert(file, secret) {
        if (!secret) throw new Error("未設定 CloudConvert API Key（請至金鑰保險箱設定）");

        // 1. Create Job
        const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + secret,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tasks: {
                    "import-my-file": { "operation": "import/upload" },
                    "convert-my-file": { 
                        "operation": "convert", 
                        "input": "import-my-file", 
                        "output_format": "pdf" 
                    },
                    "export-my-file": { 
                        "operation": "export/url", 
                        "input": "convert-my-file" 
                    }
                }
            })
        });
        const jobData = await jobRes.json();
        if (!jobRes.ok) throw new Error('任務建立失敗: ' + (jobData.message || jobRes.status));

        const uploadTask = jobData.data.tasks.find(t => t.name === 'import-my-file');
        const jobId = jobData.data.id;

        // 2. Upload File
        const formData = new FormData();
        for (const [key, val] of Object.entries(uploadTask.result.form.parameters)) {
            formData.append(key, val);
        }
        formData.append('file', file);
        
        const uploadRes = await fetch(uploadTask.result.form.url, {
            method: 'POST',
            body: formData
        });
        if (!uploadRes.ok) throw new Error('檔案上傳失敗');

        // 3. Poll Job Status
        let isFinished = false;
        let exportUrl = null;
        while (!isFinished) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
                headers: { 'Authorization': 'Bearer ' + secret }
            });
            const statusData = await statusRes.json();
            const status = statusData.data.status;
            
            if (status === 'error') throw new Error('雲端轉檔發生錯誤');
            if (status === 'finished') {
                const exportTask = statusData.data.tasks.find(t => t.name === 'export-my-file');
                if (exportTask && exportTask.result && exportTask.result.files && exportTask.result.files[0]) {
                    exportUrl = exportTask.result.files[0].url;
                    isFinished = true;
                } else {
                    throw new Error('無法取得下載連結');
                }
            }
        }

        // 4. Download PDF
        const pdfRes = await fetch(exportUrl);
        if (!pdfRes.ok) throw new Error('下載 PDF 失敗');
        const pdfBlob = await pdfRes.blob();
        const pdfFile = new File([pdfBlob], file.name.replace(/\.pptx?$/i, '.pdf'), { type: 'application/pdf' });
        
        await this.importPDFAsNewProject(pdfFile);
    }

    showAutoSaveFeedback(msg = '已自動儲存') {
        const indicator = document.getElementById('auto-save-indicator');
        if (indicator) {
            indicator.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span> ${msg}`;
            indicator.className = 'text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center transition';

            if (msg !== '已自動儲存') {
                if (this.autoSaveFeedbackTimer) clearTimeout(this.autoSaveFeedbackTimer);
                this.autoSaveFeedbackTimer = setTimeout(() => {
                    this.showAutoSaveFeedback('已自動儲存');
                }, 3000);
            }
        }
    }

    async _importPPTWithGotenberg(file, baseUrl) {
        if (!baseUrl) throw new Error("未設定 Gotenberg Base URL");
        
        this._showLoading('正在上傳簡報至本地 Gotenberg...');
        const cleanUrl = baseUrl.replace(/\/$/, '');
        const formData = new FormData();
        formData.append('files', file);

        try {
            const response = await fetch(`${cleanUrl}/forms/libreoffice/convert`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            this._showLoading('正在下載 PDF，準備建立專案...');
            
            const pdfBlob = await response.blob();
            const pdfFile = new File([pdfBlob], file.name.replace(/\.pptx?$/i, '.pdf'), { type: 'application/pdf' });
            
            await this.importPDFAsNewProject(pdfFile);
            
        } catch (error) {
            console.error('[Gotenberg] 轉檔失敗:', error);
            alert('Gotenberg 轉檔失敗: ' + error.message);
        } finally {
            this._hideLoading();
        }
    }
}
