/**
 * ShareModal.js
 * 專案分享與多人協作彈窗 (Share & Collaborate Modal)
 * 具備手繪風 (.sketch) 邊框與陰影，適配 4 款主題風格
 * 提供一鍵複製專案共編 URL、6 位數房間邀請碼、權限設定與在線成員 Presence 標識
 */

export default class ShareModal {
    constructor(eventBus, presenceManager, projectRouter) {
        this.eventBus = eventBus;
        this.presenceManager = presenceManager;
        this.projectRouter = projectRouter;

        this.modalContainer = null;
        this.isOpen = false;
        this.projectId = null;
        this.projectTitle = '未命名專案';
        this.selectedRole = 'editor'; // 'editor' | 'viewer'

        this.init();
    }

    init() {
        this.createModalDOM();
        this.bindEvents();
    }

    createModalDOM() {
        if (typeof document === 'undefined') return;

        this.modalContainer = document.createElement('div');
        this.modalContainer.id = 'collab-share-modal-container';
        this.modalContainer.className = 'fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center p-4 transition-all duration-300 opacity-0';

        this.modalContainer.innerHTML = `
            <div id="collab-share-modal" class="sketch relative w-full max-w-lg bg-white rounded-2xl border-2 border-slate-700 shadow-[6px_6px_0px_#1e293b] overflow-hidden transform scale-95 transition-all duration-300">
                
                <!-- Modal Header -->
                <div class="px-6 py-4 bg-gradient-to-r from-indigo-50 via-teal-50 to-amber-50 border-b-2 border-slate-700 flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg font-black shadow-[2px_2px_0px_#334155]">
                            <i class="fas fa-share-alt"></i>
                        </div>
                        <div>
                            <h3 class="text-base font-black text-slate-800 tracking-wide flex items-center gap-2">
                                專案協作與分享
                                <span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">v1.5.0</span>
                            </h3>
                            <p id="collab-share-project-name" class="text-xs text-slate-500 font-medium truncate max-w-[280px]">載入中...</p>
                        </div>
                    </div>
                    <button id="btn-close-collab-modal" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center text-sm font-bold transition">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Modal Body -->
                <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">

                    <!-- 專案共編邀請連結區塊 -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <i class="fas fa-link text-indigo-500"></i> 專案專屬共編連結
                            </label>
                            <span class="text-[11px] text-slate-400 font-mono">支援 Deep Linking 直通</span>
                        </div>
                        <div class="flex items-center space-x-2">
                            <div class="relative flex-1">
                                <input type="text" id="collab-share-url-input" readonly 
                                    class="w-full bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-700 select-all focus:outline-none focus:border-indigo-500 transition"
                                    value="">
                            </div>
                            <button id="btn-copy-collab-url" class="sketch-btn px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shrink-0 shadow-[2px_2px_0px_#334155] flex items-center gap-1.5">
                                <i class="fas fa-copy"></i>
                                <span id="copy-url-btn-text">複製連結</span>
                            </button>
                        </div>
                    </div>

                    <!-- 權限角色選擇 -->
                    <div class="pt-1">
                        <div class="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 space-y-1.5">
                            <div class="text-[11px] font-bold text-slate-600">
                                <i class="fas fa-user-shield text-purple-500 mr-1"></i> 預設給予權限
                            </div>
                            <select id="collab-role-selector" class="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="editor" selected>✏️ 可編輯 (Editor)</option>
                                <option value="viewer">👁️ 僅檢視 (Viewer)</option>
                            </select>
                        </div>
                    </div>

                    <!-- 在線成員 Presence 標識清單 -->
                    <div class="space-y-2.5 pt-2 border-t border-slate-200">
                        <div class="flex items-center justify-between">
                            <label class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <i class="fas fa-users text-teal-600"></i> 當前在線協作者 (Presence)
                            </label>
                            <span id="collab-online-count-badge" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                1 人在線
                            </span>
                        </div>

                        <div id="collab-peers-container" class="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                            <!-- Peers list will be rendered dynamically -->
                        </div>
                    </div>

                    <!-- 單機跨分頁測試提示 -->
                    <div class="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2.5">
                        <i class="fas fa-lightbulb text-indigo-600 mt-0.5 text-sm shrink-0"></i>
                        <p class="leading-relaxed text-[11px]">
                            <strong>單機即時測試提示：</strong>可點擊「複製連結」後，於<strong>無痕視窗</strong>或<strong>另一個瀏覽器分頁</strong>貼上開啟，即可透過 <code class="bg-indigo-100 px-1 py-0.5 rounded text-indigo-800 font-mono">BroadcastChannel</code> 體驗無伺服器跨視窗即時 Presence 感知！
                        </p>
                    </div>

                </div>

                <!-- Modal Footer -->
                <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
                    <button id="btn-collab-modal-done" class="sketch-btn px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-[2px_2px_0px_#334155]">
                        完成
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(this.modalContainer);
    }

    bindEvents() {
        if (!this.modalContainer) return;

        // 關閉按鈕
        const btnClose = this.modalContainer.querySelector('#btn-close-collab-modal');
        const btnDone = this.modalContainer.querySelector('#btn-collab-modal-done');
        if (btnClose) btnClose.addEventListener('click', () => this.close());
        if (btnDone) btnDone.addEventListener('click', () => this.close());

        // 點擊遮罩關閉
        this.modalContainer.addEventListener('click', (e) => {
            if (e.target === this.modalContainer) {
                this.close();
            }
        });

        // 複製 URL 按鈕
        const btnCopyUrl = this.modalContainer.querySelector('#btn-copy-collab-url');
        if (btnCopyUrl) {
            btnCopyUrl.addEventListener('click', () => this.copyShareUrl());
        }

        // 權限切換
        const roleSelector = this.modalContainer.querySelector('#collab-role-selector');
        if (roleSelector) {
            roleSelector.addEventListener('change', (e) => {
                this.selectedRole = e.target.value;
                this.updateUI();
            });
        }

        // 監聽 EventBus 事件
        if (this.eventBus) {
            this.eventBus.on('COLLAB:OPEN_SHARE_MODAL', (data) => {
                const projId = data && data.projectId ? data.projectId : null;
                const title = data && data.title ? data.title : '我的專案';
                const roomId = data && data.roomId ? data.roomId : null;
                this.open(projId, title, roomId);
            });

            this.eventBus.on('COLLAB:PRESENCE_UPDATE', () => {
                if (this.isOpen) {
                    this.renderPeersList();
                }
            });
        }
    }

    /**
     * 開啟分享彈窗
     */
    open(projectId = null, projectTitle = null) {
        if (!this.modalContainer) return;

        this.projectId = projectId || (this.projectRouter ? this.projectRouter.currentProjectId : null);
        this.projectTitle = projectTitle || '當前專案';

        if (!this.projectId) {
            alert('請先開啟或建立專案後再進行協作分享！');
            return;
        }

        this.isOpen = true;
        this.updateUI();
        this.renderPeersList();

        // 確保 Presence 通道處於連線狀態
        if (this.eventBus) {
            this.eventBus.emit('COLLAB:CONNECT_ROOM', {
                projectId: this.projectId,
                roomId: this.projectId
            });
        }

        this.modalContainer.classList.remove('hidden');
        this.modalContainer.classList.add('flex');
        
        requestAnimationFrame(() => {
            this.modalContainer.classList.remove('opacity-0');
            const modal = document.getElementById('collab-share-modal');
            if (modal) {
                modal.classList.remove('scale-95');
                modal.classList.add('scale-100');
            }
        });
    }

    /**
     * 關閉彈窗
     */
    close() {
        if (!this.modalContainer || !this.isOpen) return;

        this.modalContainer.classList.add('opacity-0');
        const modal = document.getElementById('collab-share-modal');
        if (modal) {
            modal.classList.remove('scale-100');
            modal.classList.add('scale-95');
        }

        setTimeout(() => {
            this.modalContainer.classList.add('hidden');
            this.modalContainer.classList.remove('flex');
            this.isOpen = false;
        }, 250);
    }

    /**
     * 更新彈窗介面內容
     */
    updateUI() {
        if (!this.modalContainer) return;

        const titleElem = this.modalContainer.querySelector('#collab-share-project-name');
        if (titleElem) {
            titleElem.textContent = `${this.projectTitle} (${this.projectId})`;
        }

        const urlInput = this.modalContainer.querySelector('#collab-share-url-input');
        if (urlInput && this.projectRouter) {
            // 不再傳遞 roomPin，改用 projectId 作為房間號
            const shareUrl = this.projectRouter.getShareUrl(this.projectId, this.selectedRole);
            urlInput.value = shareUrl;
        }
    }

    /**
     * 渲染在線成員列表
     */
    renderPeersList() {
        const container = this.modalContainer ? this.modalContainer.querySelector('#collab-peers-container') : null;
        const countBadge = this.modalContainer ? this.modalContainer.querySelector('#collab-online-count-badge') : null;
        if (!container || !this.presenceManager) return;

        const users = this.presenceManager.getAllOnlineUsers();
        if (countBadge) {
            countBadge.textContent = `${users.length} 人在線`;
        }

        container.innerHTML = users.map(user => {
            const isLocal = user.isLocal;
            const colorBg = user.color ? user.color.bg : '#6366f1';
            const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

            return `
                <div class="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-6 h-6 rounded-full text-white font-bold flex items-center justify-center text-[10px] shadow-sm" style="background-color: ${colorBg};">
                            ${initial}
                        </div>
                        <div>
                            <span class="font-bold text-slate-800">${user.name}</span>
                            ${isLocal ? '<span class="ml-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">你</span>' : ''}
                        </div>
                    </div>
                    <div class="flex items-center space-x-1.5">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span class="text-[11px] text-slate-500 font-medium">${user.role === 'admin' ? '擁有者' : (user.role === 'editor' ? '編輯者' : '檢視者')}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 複製分享 URL 至剪貼簿
     */
    async copyShareUrl() {
        const urlInput = this.modalContainer.querySelector('#collab-share-url-input');
        const btnText = this.modalContainer.querySelector('#copy-url-btn-text');
        const btn = this.modalContainer.querySelector('#btn-copy-collab-url');

        if (!urlInput || !urlInput.value) return;

        try {
            await navigator.clipboard.writeText(urlInput.value);
            if (btnText && btn) {
                btnText.textContent = '已複製！';
                btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

                setTimeout(() => {
                    btnText.textContent = '複製連結';
                    btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
                    btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
                }, 2000);
            }
        } catch (e) {
            urlInput.select();
            document.execCommand('copy');
            alert('已複製專案連結至剪貼簿！');
        }
    }
}
