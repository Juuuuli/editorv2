/**
 * index.js
 * 多人共編與專案協作模組統一出口 (Collaboration Module Index)
 */

import PresenceManager, { PRESENCE_COLORS } from './PresenceManager.js';
import CollabChannel from './CollabChannel.js';
import ShareModal from './ShareModal.js';

export {
    PresenceManager,
    CollabChannel,
    ShareModal,
    PRESENCE_COLORS
};

export default class CollaborationModule {
    constructor(eventBus, authManager, projectRouter) {
        this.eventBus = eventBus;
        this.authManager = authManager;
        this.projectRouter = projectRouter;

        this.presenceManager = new PresenceManager(this.eventBus, this.authManager);
        this.collabChannel = new CollabChannel(this.eventBus, this.presenceManager);
        this.shareModal = new ShareModal(this.eventBus, this.presenceManager, this.projectRouter);

        console.log('[CollaborationModule] 多人共編與分享前置模組初始化完成 (v1.5.0)');
    }

    openShareModal(projectId = null, title = null, roomId = null) {
        if (this.shareModal) {
            this.shareModal.open(projectId, title, roomId);
        }
    }
}
