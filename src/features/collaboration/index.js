/**
 * index.js
 * 多人共編與專案協作模組統一出口 (Collaboration Module Index)
 */

import PresenceManager, { PRESENCE_COLORS } from './PresenceManager.js';
import CollabChannel from './CollabChannel.js';
import ShareModal from './ShareModal.js';
import CollabEngine from './CollabEngine.js';
import YjsAdapter from './YjsAdapter.js';
import MultiplayerCursorOverlay from './MultiplayerCursorOverlay.js';
import ObjectLeaseManager from './ObjectLeaseManager.js';

export {
    PresenceManager,
    CollabChannel,
    ShareModal,
    CollabEngine,
    YjsAdapter,
    MultiplayerCursorOverlay,
    ObjectLeaseManager,
    PRESENCE_COLORS
};

export default class CollaborationModule {
    constructor(eventBus, authManager, projectRouter, canvasEngine) {
        this.eventBus = eventBus;
        this.authManager = authManager;
        this.projectRouter = projectRouter;
        this.canvasEngine = canvasEngine;

        this.presenceManager = new PresenceManager(this.eventBus, this.authManager);
        this.collabChannel = new CollabChannel(this.eventBus, this.presenceManager); // 保留做為降級或輔助用
        this.collabEngine = new CollabEngine(this.eventBus, this.presenceManager);
        this.shareModal = new ShareModal(this.eventBus, this.presenceManager, this.projectRouter);

        this.yjsAdapter = null;
        this.cursorOverlay = null;
        this.leaseManager = null;

        // 當 CollabEngine 完成連線，Y.Doc 準備好時，掛載到畫布
        this.eventBus.on('COLLAB:ENGINE_READY', (data) => {
            const { ydoc, provider, awareness } = data;
            
            // 清理舊的實例
            if (this.yjsAdapter) this.yjsAdapter.destroy();
            if (this.cursorOverlay) this.cursorOverlay.destroy();
            if (this.leaseManager) this.leaseManager.destroy();

            // 若有 canvasEngine，則綁定
            if (this.canvasEngine && this.canvasEngine.canvas) {
                // 這裡簡化為固定綁定 page_1，實務上應該監聽頁面切換事件
                this.yjsAdapter = new YjsAdapter(this.canvasEngine.canvas, ydoc, 'page_1');
                
                // 游標渲染層 (需掛載在 canvas 容器上)
                const container = document.getElementById('workspace-container');
                if (container) {
                    this.cursorOverlay = new MultiplayerCursorOverlay(container, awareness);
                }

                this.leaseManager = new ObjectLeaseManager(this.canvasEngine.canvas, awareness);
            }
        });

        console.log('[CollaborationModule] 多人共編與分享模組初始化完成 (v2.0.0)');
    }

    openShareModal(projectId = null, title = null, roomId = null) {
        if (this.shareModal) {
            this.shareModal.open(projectId, title, roomId);
        }
    }
}
