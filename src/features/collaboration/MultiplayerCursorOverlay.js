/**
 * MultiplayerCursorOverlay.js
 * 獨立的游標渲染層，顯示遠端使用者的滑鼠位置與名稱
 */

export default class MultiplayerCursorOverlay {
    constructor(container, awareness, eventBus = null, currentPageId = 'page-1') {
        this.container = container;
        this.awareness = awareness;
        this.eventBus = eventBus;
        this.currentPageId = currentPageId;
        
        // 建立疊加的 DOM 容器
        this.overlay = document.createElement('div');
        this.overlay.className = 'multiplayer-cursors-overlay absolute inset-0 pointer-events-none z-50 overflow-hidden';
        this.container.appendChild(this.overlay);

        this.cursors = new Map(); // clientId -> DOM Element

        // 初始設定本地使用者的所在頁面
        if (this.awareness) {
            const user = this.awareness.getLocalState()?.user;
            if (user) {
                this.awareness.setLocalStateField('user', { ...user, currentPageId: this.currentPageId });
            }
        }

        this.bindEvents();
    }

    bindEvents() {
        if (!this.awareness) return;

        this.awareness.on('change', () => {
            this.renderCursors();
        });

        // 監聽本地滑鼠移動並更新 Awareness，加入 throttle 避免每秒發送上百次拖垮 Firebase
        let lastMoveTime = 0;
        this.container.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMoveTime < 50) return; // 限制更新頻率為 ~20fps
            lastMoveTime = now;
            
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.awareness.setLocalStateField('cursor', { x, y });
        });

        // 監聽頁面切換，更新自己所在的頁面，並重新渲染游標
        if (this.eventBus) {
            this.eventBus.on('PAGE:SWITCH', ({ newPageId }) => {
                this.currentPageId = newPageId;
                const user = this.awareness.getLocalState()?.user;
                if (user) {
                    this.awareness.setLocalStateField('user', { ...user, currentPageId: this.currentPageId });
                }
                this.renderCursors();
            });
        }
    }

    renderCursors() {
        const states = this.awareness.getStates();
        const localClientId = this.awareness.clientID;

        // 移除已經離線的游標
        const currentClientIds = Array.from(states.keys());
        for (const [clientId, element] of this.cursors.entries()) {
            if (!currentClientIds.includes(clientId)) {
                element.remove();
                this.cursors.delete(clientId);
            }
        }

        states.forEach((state, clientId) => {
            // 不渲染自己的游標
            if (clientId === localClientId) return;

            const cursor = state.cursor;
            const user = state.user;

            // 僅當游標存在、使用者資料存在，且使用者與自己處於同一頁面時才渲染
            if (cursor && user && user.currentPageId === this.currentPageId) {
                let element = this.cursors.get(clientId);

                if (!element) {
                    element = this.createCursorElement(user);
                    this.overlay.appendChild(element);
                    this.cursors.set(clientId, element);
                }

                // LERP 動畫或 CSS Transition 平滑移動
                element.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
            } else {
                // 如果沒有 cursor 資料，或是使用者不在同頁面，則隱藏/移除 DOM
                const element = this.cursors.get(clientId);
                if (element) {
                    element.remove();
                    this.cursors.delete(clientId);
                }
            }
        });
    }

    createCursorElement(user) {
        const el = document.createElement('div');
        el.className = 'remote-cursor absolute top-0 left-0 flex flex-col items-start transition-transform duration-100 ease-linear pointer-events-none z-[100]';
        
        let bgColor = '#F59E0B';
        let textColor = '#ffffff';
        
        if (user.color) {
            if (typeof user.color === 'object' && user.color.bg) {
                bgColor = user.color.bg;
                if (user.color.text) textColor = user.color.text;
            } else if (typeof user.color === 'string') {
                bgColor = user.color;
            }
        }
        
        const name = user.name || 'Anonymous';

        el.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="${bgColor}" stroke="white" stroke-width="2" class="drop-shadow-md relative -left-1 -top-1 z-10">
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z"></path>
            </svg>
            <div class="cursor-name px-2 py-0.5 text-[11px] font-bold rounded shadow-md whitespace-nowrap z-20" style="background-color: ${bgColor}; color: ${textColor}; transform: translate(10px, -5px);">
                ${name}
            </div>
        `;
        return el;
    }

    destroy() {
        if (this.overlay) {
            this.overlay.remove();
        }
        this.cursors.clear();
    }
}
