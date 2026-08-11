/**
 * MultiplayerCursorOverlay.js
 * 獨立的游標渲染層，顯示遠端使用者的滑鼠位置與名稱
 */

export default class MultiplayerCursorOverlay {
    constructor(container, awareness) {
        this.container = container;
        this.awareness = awareness;
        
        // 建立疊加的 DOM 容器
        this.overlay = document.createElement('div');
        this.overlay.className = 'multiplayer-cursors-overlay absolute inset-0 pointer-events-none z-50 overflow-hidden';
        this.container.appendChild(this.overlay);

        this.cursors = new Map(); // clientId -> DOM Element

        this.bindEvents();
    }

    bindEvents() {
        if (!this.awareness) return;

        this.awareness.on('change', () => {
            this.renderCursors();
        });

        // 監聽本地滑鼠移動並更新 Awareness
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.awareness.setLocalStateField('cursor', { x, y });
        });
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

            if (cursor && user) {
                let element = this.cursors.get(clientId);

                if (!element) {
                    element = this.createCursorElement(user);
                    this.overlay.appendChild(element);
                    this.cursors.set(clientId, element);
                }

                // LERP 動畫或 CSS Transition 平滑移動
                element.style.transform = `translate(${cursor.x}px, ${cursor.y}px)`;
            } else {
                // 如果沒有 cursor 資料，移除 DOM
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
        el.className = 'remote-cursor absolute top-0 left-0 flex flex-col items-start transition-transform duration-100 ease-linear pointer-events-none';
        
        const color = user.color || '#F59E0B';
        const name = user.name || 'Anonymous';

        el.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" class="drop-shadow-md relative -left-1 -top-1">
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z"></path>
            </svg>
            <div class="cursor-name px-2 py-0.5 text-[10px] font-bold text-white rounded-md shadow-md mt-1 whitespace-nowrap" style="background-color: ${color};">
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
