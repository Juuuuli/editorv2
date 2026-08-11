/**
 * ProjectRouter.js
 * SPA 專案網址路由管理器 (SPA Project Router)
 * 負責處理 ?project=[ID]&room=[ROOM_ID] 的 URL 路由、瀏覽器歷史 (History API)、Deep Linking 與 Popstate 監聽
 */

export default class ProjectRouter {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentProjectId = null;
        this.currentRoomId = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized || typeof window === 'undefined') return;

        // 初始化載入時解析當前網址
        const { projectId, roomId } = this.getQueryParams();
        this.currentProjectId = projectId;
        this.currentRoomId = roomId;

        // 監聽瀏覽器上一頁/下一頁 (Popstate) 事件
        window.addEventListener('popstate', (event) => {
            this.handlePopState(event);
        });

        // 監聽 EventBus 路由導航請求
        if (this.eventBus) {
            this.eventBus.on('ROUTER:NAVIGATE_PROJECT', (data) => {
                if (!data || !data.projectId) return;
                this.navigateToProject(data.projectId, data.roomId || null, data.replace || false);
            });

            this.eventBus.on('ROUTER:NAVIGATE_DASHBOARD', (data) => {
                const replace = data && data.replace ? true : false;
                this.navigateToDashboard(replace);
            });
        }

        this.isInitialized = true;
        console.log('[ProjectRouter] SPA 專案路由管理器初始化完成');
    }

    /**
     * 解析當前網址 Query 參數
     * @returns {{ projectId: string|null, roomId: string|null, hasProject: boolean }}
     */
    getQueryParams() {
        if (typeof window === 'undefined') return { projectId: null, roomId: null, hasProject: false };

        const searchParams = new URLSearchParams(window.location.search);
        const projectId = searchParams.get('project') || searchParams.get('projectId') || null;
        const roomId = searchParams.get('room') || searchParams.get('roomId') || null;

        return {
            projectId: projectId ? projectId.trim() : null,
            roomId: roomId ? roomId.trim() : null,
            hasProject: Boolean(projectId && projectId.trim())
        };
    }

    /**
     * 處理瀏覽器 Popstate (上一頁 / 下一頁)
     */
    handlePopState(event) {
        const { projectId, roomId, hasProject } = this.getQueryParams();
        console.log(`[ProjectRouter] 偵測到瀏覽器歷史堆疊切換 -> project: ${projectId}, room: ${roomId}`);

        this.currentProjectId = projectId;
        this.currentRoomId = roomId;

        if (hasProject) {
            if (this.eventBus) {
                this.eventBus.emit('ROUTER:PROJECT_CHANGED', {
                    projectId,
                    roomId,
                    fromHistory: true,
                    state: event ? event.state : null
                });
            }
        } else {
            if (this.eventBus) {
                this.eventBus.emit('ROUTER:DASHBOARD_REQUESTED', {
                    fromHistory: true,
                    state: event ? event.state : null
                });
            }
        }
    }

    /**
     * 導航至特定專案網址 (URL Query: ?project=xxx&room=yyy)
     * @param {string} projectId 專案 ID
     * @param {string|null} roomId 協作房間號 (可選)
     * @param {boolean} replace 是否使用 replaceState 替換當前歷史
     */
    navigateToProject(projectId, roomId = null, replace = false) {
        if (!projectId || typeof window === 'undefined') return;

        this.currentProjectId = projectId;
        this.currentRoomId = roomId;

        const url = new URL(window.location.href);
        url.searchParams.set('project', projectId);

        if (roomId) {
            url.searchParams.set('room', roomId);
        } else {
            url.searchParams.delete('room');
        }

        const stateObj = { projectId, roomId, timestamp: Date.now() };

        if (replace) {
            window.history.replaceState(stateObj, '', url.toString());
        } else {
            // 避免重複推入相同 URL
            const currentUrl = window.location.href;
            if (currentUrl !== url.toString()) {
                window.history.pushState(stateObj, '', url.toString());
            }
        }

        console.log(`[ProjectRouter] 路由更新 -> ${url.search}`);
    }

    /**
     * 導航回儀表板首頁 (清除 ?project 參數)
     * @param {boolean} replace 是否使用 replaceState
     */
    navigateToDashboard(replace = false) {
        if (typeof window === 'undefined') return;

        this.currentProjectId = null;
        this.currentRoomId = null;

        const url = new URL(window.location.href);
        url.searchParams.delete('project');
        url.searchParams.delete('projectId');
        url.searchParams.delete('room');
        url.searchParams.delete('roomId');

        const stateObj = { dashboard: true, timestamp: Date.now() };

        if (replace) {
            window.history.replaceState(stateObj, '', url.toString());
        } else {
            const currentUrl = window.location.href;
            if (currentUrl !== url.toString()) {
                window.history.pushState(stateObj, '', url.toString());
            }
        }

        console.log(`[ProjectRouter] 導航回首頁儀表板 -> ${url.pathname}`);
    }

    /**
     * 取得特定專案的完整絕對共編分享 URL
     * @param {string} projectId 專案 ID
     * @param {string|null} roomId 房間號
     * @returns {string} 完整的分享 URL
     */
    getShareUrl(projectId, roomId = null) {
        if (typeof window === 'undefined') return '';
        const targetId = projectId || this.currentProjectId;
        if (!targetId) return window.location.href;

        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('project', targetId);
        if (roomId) {
            url.searchParams.set('room', roomId);
        }
        return url.toString();
    }
}
