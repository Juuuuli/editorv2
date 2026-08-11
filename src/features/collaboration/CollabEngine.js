/**
 * CollabEngine.js
 * 協作通訊底層引擎 (基於 Yjs & WebRTC)
 * 負責維護 Y.Doc 生命週期、連線房間與 Awareness 狀態廣播
 */

import * as Y from 'yjs';
import FirebaseProvider from './FirebaseProvider.js';

export default class CollabEngine {
    constructor(eventBus, presenceManager) {
        this.eventBus = eventBus;
        this.presenceManager = presenceManager;
        
        this.ydoc = null;
        this.provider = null;
        this.awareness = null;
        
        this.projectId = null;
        this.roomId = null;

        this.bindEvents();
    }

    bindEvents() {
        if (!this.eventBus) return;

        // 當系統要求連線協作房間時
        this.eventBus.on('COLLAB:CONNECT_ROOM', (data) => {
            if (!data || !data.projectId) return;
            this.connect(data.projectId, data.roomId || data.projectId);
        });

        // 斷線
        this.eventBus.on('COLLAB:DISCONNECT_ROOM', () => {
            this.disconnect();
        });

        // 當本地使用者的色彩或名稱變更時，更新 Awareness
        this.eventBus.on('COLLAB:LOCAL_PRESENCE_UPDATED', (user) => {
            if (this.awareness) {
                this.awareness.setLocalStateField('user', user);
            }
        });
    }

    /**
     * 連線至 Yjs 房間
     */
    connect(projectId, roomId) {
        if (this.projectId === projectId && this.roomId === roomId && this.provider) {
            return; // 已經連線
        }

        this.disconnect();

        this.projectId = projectId;
        this.roomId = roomId;
        const roomName = `editorv2_yjs_${projectId}_${roomId}`;

        console.log(`[CollabEngine] 啟動 Firebase 共編連線，房間：${roomName}`);

        // 初始化 Y.Doc
        this.ydoc = new Y.Doc();

        // 建立 Firebase Provider
        this.provider = new FirebaseProvider(roomName, this.ydoc);

        this.awareness = this.provider.awareness;

        // 初始化本地 Awareness 狀態 (游標、顏色、使用者資訊)
        const localUser = this.presenceManager ? this.presenceManager.getLocalUser() : { id: 'unknown', name: 'Guest', color: '#000000' };
        this.awareness.setLocalState({
            user: localUser,
            cursor: null,     // { x, y }
            selection: []     // ['object_id_1', 'object_id_2']
        });

        // 監聽遠端 Awareness 變更 (如游標移動、選取狀態)
        this.awareness.on('change', () => {
            const states = Array.from(this.awareness.getStates().values());
            if (this.eventBus) {
                this.eventBus.emit('COLLAB:AWARENESS_UPDATE', states);
            }
        });

        if (this.eventBus) {
            this.eventBus.emit('COLLAB:ENGINE_READY', {
                ydoc: this.ydoc,
                provider: this.provider,
                awareness: this.awareness
            });
        }
    }

    /**
     * 更新本地游標座標至 Awareness
     */
    updateCursor(x, y) {
        if (!this.awareness) return;
        this.awareness.setLocalStateField('cursor', { x, y });
    }

    /**
     * 更新本地選取狀態至 Awareness (Object Lease)
     */
    updateSelection(objectIds) {
        if (!this.awareness) return;
        this.awareness.setLocalStateField('selection', objectIds || []);
    }

    /**
     * 斷線清理
     */
    disconnect() {
        if (this.provider) {
            this.provider.destroy();
            this.provider = null;
        }
        if (this.ydoc) {
            this.ydoc.destroy();
            this.ydoc = null;
        }
        this.awareness = null;
        this.projectId = null;
        this.roomId = null;
        
        console.log('[CollabEngine] 已斷開 Yjs 連線');
    }
}
