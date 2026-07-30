export default class PanelManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.bindEvents();
    }

    bindEvents() {
        const tabsContainer = document.getElementById('sidebar-tabs');
        if (!tabsContainer) return;

        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;

            const targetId = btn.dataset.target;
            this.switchPanel(btn.id, targetId);
        });

        // 監聽物件選取事件，自動跳轉到屬性面板
        if (this.eventBus) {
            this.eventBus.on('CANVAS:OBJECT_SELECTED', (data) => {
                // 如果是面板自身的更新，不要跳轉
                if (this.propertiesPanel && this.propertiesPanel.isUpdatingFromPanel) {
                    return;
                }

                // 如果是選取框或特定疊加層，不需要跳轉到屬性面板
                const t = data && data.target;
                const isRegion = t && (
                    t.isRegionBox || 
                    t.type === 'activeSelection' ||
                    t.fill === 'rgba(255,0,0,0.05)' || 
                    t.fill === 'rgba(255, 0, 0, 0.05)' ||
                    (t.stroke === 'red' && t.strokeDashArray)
                );
                if (isRegion) {
                    return;
                }
                this.switchPanel('tab-properties', 'panel-properties');
            });
            
            // 監聽來自其他模組的跳轉請求
            this.eventBus.on('UI:SWITCH_PANEL', ({ tabId, panelId }) => {
                this.switchPanel(tabId, panelId);
            });
        }
    }

    switchPanel(activeTabId, targetPanelId) {
        // 1. 重置所有 Tab 樣式
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('text-slate-800', 'border-indigo-500', 'bg-white');
            btn.classList.add('text-slate-400', 'border-transparent');
        });

        // 2. 點亮目標 Tab
        const activeTab = document.getElementById(activeTabId);
        if (activeTab) {
            activeTab.classList.remove('text-slate-400', 'border-transparent');
            activeTab.classList.add('text-slate-800', 'border-indigo-500', 'bg-white');
        }

        // 3. 隱藏所有 Panel
        document.querySelectorAll('.sidebar-panel').forEach(panel => {
            panel.style.display = 'none';
        });

        // 4. 顯示目標 Panel
        const targetPanel = document.getElementById(targetPanelId);
        if (targetPanel) {
            targetPanel.style.display = 'block';
            if (targetPanelId === 'panel-layers') {
                targetPanel.style.display = 'flex';
            }
        }
        
        // 5. 廣播事件
        if(this.eventBus) {
            this.eventBus.emit('UI:PANEL_CHANGED', { panel: targetPanelId });
        }
    }
}
