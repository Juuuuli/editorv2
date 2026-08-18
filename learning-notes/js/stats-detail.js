document.addEventListener('DOMContentLoaded', () => {
    // 統計卡片資料對應表
    const statData = {
        '原始碼模組': {
            title: '原始碼模組 (完整清單)',
            items: [
                // Core
                { label: 'EventBus.js (全域事件)', section: 'sec-eventbus' },
                { label: 'main.js (系統入口)', section: 'sec-overview' },
                { label: 'ProjectRouter.js (路由與 SPA)', section: 'sec-core' },
                { label: 'CanvasEngine.js (繪圖引擎核心)', section: 'sec-core' },
                // Features - Auth & Dashboard
                { label: 'AuthManager.js (身分驗證)', section: 'sec-overview' },
                { label: 'DashboardManager.js (儀表板)', section: 'sec-overview' },
                // Features - Tools
                { label: 'BasicTools.js (基礎繪圖工具)', section: 'sec-tools' },
                { label: 'ObjectsTools.js (物件與表格插入)', section: 'sec-tools' },
                { label: 'tableBuilder.js (表格建構邏輯)', section: 'sec-tools' },
                { label: 'SmartTools.js (智能與 AI 工具)', section: 'sec-tools' },
                { label: 'KeyboardShortcuts.js (快捷鍵)', section: 'sec-tools' },
                { label: 'FloatingToolsManager.js (浮動工具列)', section: 'sec-tools' },
                // Features - Panels
                { label: 'PanelManager.js (面板管理器)', section: 'sec-panels' },
                { label: 'PropertiesPanel.js (屬性面板)', section: 'sec-panels' },
                { label: 'LayersPanel.js (圖層面板)', section: 'sec-panels' },
                { label: 'AssetsPanel.js (素材庫面板)', section: 'sec-panels' },
                { label: 'AssetsManager.js (素材管理)', section: 'sec-panels' },
                // Features - Workspace & Storage
                { label: 'WorkspaceManager.js (工作區管理)', section: 'sec-workspace' },
                { label: 'RatioManager.js (畫布比例控制)', section: 'sec-workspace' },
                { label: 'FileImportManager.js (檔案匯入)', section: 'sec-workspace' },
                { label: 'ExportManager.js (匯出與列印)', section: 'sec-workspace' },
                { label: 'ThumbnailsPanel.js (縮圖導覽)', section: 'sec-workspace' },
                { label: 'ProjectStorageEngine.js (本地儲存)', section: 'sec-storage' },
                // Features - Collab
                { label: 'CollabEngine.js (協作引擎)', section: 'sec-collab' },
                { label: 'YjsAdapter.js (CRDT 轉換)', section: 'sec-collab' },
                { label: 'FirebaseProvider.js (雲端同步)', section: 'sec-collab' },
                { label: 'CollabChannel.js (RTC 頻道)', section: 'sec-collab' },
                { label: 'PresenceManager.js (狀態廣播)', section: 'sec-collab' },
                { label: 'MultiplayerCursorOverlay.js (多人游標)', section: 'sec-collab' },
                { label: 'ObjectLeaseManager.js (物件鎖)', section: 'sec-collab' },
                { label: 'ShareModal.js (分享設定)', section: 'sec-collab' },
                // Features - AI & Vault
                { label: 'AIProviderAdapter.js (AI 供應商介面)', section: 'sec-ai' },
                { label: 'ApiVaultManager.js (金鑰保險箱)', section: 'sec-ai' }
            ]
        },
        'NPM 套件': {
            title: 'NPM 套件依賴',
            items: [
                { label: 'Fabric.js (畫布底層)', section: 'sec-core' },
                { label: 'Yjs (CRDT 協作演算法)', section: 'sec-collab' },
                { label: 'Firebase (Auth & Storage)', section: 'sec-collab' },
                { label: 'Tailwind CSS (UI 樣式)', section: 'sec-theme' }
            ]
        },
        '主題風格': {
            title: '支援的主題風格',
            items: [
                { label: 'Light 亮色模式', section: 'sec-theme' },
                { label: 'Dark 深色模式', section: 'sec-theme' },
                { label: 'System 跟隨系統', section: 'sec-theme' },
                { label: 'Custom 自訂色彩 (ThemeVariables)', section: 'sec-theme' }
            ]
        },
        'AI Provider': {
            title: 'AI 供應商模組',
            items: [
                { label: 'Google Gemini (內建)', section: 'sec-ai' },
                { label: 'OpenAI (內建)', section: 'sec-ai' },
                { label: 'Anthropic Claude (內建)', section: 'sec-ai' },
                { label: 'Custom Endpoint (自訂模型)', section: 'sec-ai' }
            ]
        }
    };

    // 建立 Modal DOM
    const modalHTML = `
        <div class="stats-modal-overlay" id="stats-modal-overlay">
            <div class="stats-modal">
                <div class="stats-modal-header">
                    <h3 id="stats-modal-title">標題</h3>
                    <button class="stats-modal-close" id="stats-modal-close"><i class="ti ti-x"></i></button>
                </div>
                <div class="stats-modal-list" id="stats-modal-list">
                    <!-- 項目會動態產生在這裡 -->
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const overlay = document.getElementById('stats-modal-overlay');
    const closeBtn = document.getElementById('stats-modal-close');
    const titleEl = document.getElementById('stats-modal-title');
    const listEl = document.getElementById('stats-modal-list');

    // 關閉 Modal
    function closeModal() {
        overlay.classList.remove('show');
    }
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // 點擊項目並跳轉閃爍
    window.jumpToDetail = function(sectionId, keyword) {
        closeModal();
        
        // 使用原本的 switchSection 函數 (如果存在)
        if (typeof window.switchSection === 'function') {
            window.switchSection(sectionId);
        }

        let sectionEl = document.getElementById(sectionId);
        if (!sectionEl) return;
        
        let targetEl = sectionEl;

        // 如果有提供 keyword，嘗試在該 section 內尋找包含 keyword 的具體區塊
        if (keyword) {
            // 從常見的具體區塊層級開始找
            const possibleTargets = Array.from(sectionEl.querySelectorAll('.card, .sub-title, .mermaid-wrap, pre, .grid2 > div, .grid4 > div'));
            for (let el of possibleTargets) {
                if (el.textContent.includes(keyword)) {
                    // 為了閃爍效果好看，盡量選取外層的 card 或是它自己
                    targetEl = el.closest('.card') || el;
                    break;
                }
            }
        }

        if (targetEl) {
            // 延遲一點點確保 display: block 與 Mermaid 渲染已完成計算
            setTimeout(() => {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // 加入閃爍動畫
                targetEl.classList.remove('flash-target');
                void targetEl.offsetWidth; // 觸發 reflow
                targetEl.classList.add('flash-target');
                
                setTimeout(() => {
                    targetEl.classList.remove('flash-target');
                }, 1500);
            }, 100);
        }
    };

    // 綁定點擊事件到 .stat 卡片
    document.querySelectorAll('.stat').forEach(statCard => {
        statCard.setAttribute('title', '點擊查看詳細列表');
        statCard.addEventListener('click', () => {
            const labelEl = statCard.querySelector('.l');
            if (!labelEl) return;
            
            const rawText = labelEl.textContent.trim();
            const data = statData[rawText];
            
            if (data) {
                titleEl.textContent = data.title;
                listEl.innerHTML = data.items.map(item => {
                    // 擷取英文或第一組連續英數當作 keyword (例如 'EventBus.js' -> 'EventBus')
                    const match = item.label.match(/^[a-zA-Z0-9_-]+/);
                    const keyword = match ? match[0] : '';
                    return `
                    <button class="stats-modal-item" onclick="jumpToDetail('${item.section}', '${keyword}')">
                        <i class="ti ti-arrow-right"></i> ${item.label}
                    </button>
                    `;
                }).join('');
                overlay.classList.add('show');
            }
        });
    });
});
