/**
 * CollabChannel.js
 * 本機與跨分頁即時協作通道 (BroadcastChannel Wrapper)
 * 支援無後端伺服器環境下的單機多分頁即時 Presence 感知與狀態廣播
 */

export default class CollabChannel {
    constructor(eventBus, presenceManager) {
        this.eventBus = eventBus;
        this.presenceManager = presenceManager;

        this.channel = null;
        this.channelName = null;
        this.heartbeatTimer = null;
        this.projectId = null;
        this.roomId = null;

        this.bindEvents();
    }

    bindEvents() {
        if (this.eventBus) {
            this.eventBus.on('COLLAB:CONNECT_ROOM', (data) => {
                if (!data || !data.projectId) return;
                this.connect(data.projectId, data.roomId || 'main');
            });

            this.eventBus.on('COLLAB:DISCONNECT_ROOM', () => {
                this.disconnect();
            });

            this.eventBus.on('COLLAB:BROADCAST_PRESENCE', (user) => {
                this.send('PRESENCE_HEARTBEAT', { user: user || this.presenceManager.getLocalUser() });
            });
        }

        // 監聽頁面關閉事件，通知其他分頁退出
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.send('PRESENCE_LEAVE', { userId: this.presenceManager.getLocalUser().id });
                this.disconnect();
            });
        }
    }

    /**
     * 連線至特定專案協作房間
     */
    connect(projectId, roomId = 'main') {
        if (this.projectId === projectId && this.roomId === roomId && this.channel) {
            return; // 已在相同房間
        }

        this.disconnect();

        this.projectId = projectId;
        this.roomId = roomId;
        this.channelName = `editorv2_collab_${projectId}_${roomId}`;

        try {
            if (typeof BroadcastChannel !== 'undefined') {
                this.channel = new BroadcastChannel(this.channelName);
                this.channel.onmessage = (event) => this.handleMessage(event);

                console.log(`[CollabChannel] 成功加入協作廣播通道: ${this.channelName}`);

                if (this.presenceManager) {
                    this.presenceManager.setRoom(roomId);
                }

                // 立即廣播加入事件
                this.send('PRESENCE_JOIN', { user: this.presenceManager.getLocalUser() });

                // 啟動定時心跳 (每 3 秒廣播一次 Presence)
                this.startHeartbeat();

                if (this.eventBus) {
                    this.eventBus.emit('COLLAB:ROOM_JOINED', {
                        projectId: this.projectId,
                        roomId: this.roomId,
                        channelName: this.channelName
                    });
                }
            } else {
                console.warn('[CollabChannel] 瀏覽器不支援 BroadcastChannel，協作通道以降級模式運行');
            }
        } catch (e) {
            console.error('[CollabChannel] 連線廣播通道失敗:', e);
        }
    }

    /**
     * 斷開房間連線
     */
    disconnect() {
        this.stopHeartbeat();

        if (this.channel) {
            try {
                this.send('PRESENCE_LEAVE', { userId: this.presenceManager.getLocalUser().id });
                this.channel.close();
            } catch (e) {
                // ignore
            }
            this.channel = null;
        }

        this.projectId = null;
        this.roomId = null;
        this.channelName = null;
    }

    /**
     * 發送訊息至廣播通道
     */
    send(type, payload = {}) {
        if (!this.channel) return;

        const message = {
            type,
            payload,
            timestamp: Date.now(),
            senderId: this.presenceManager.getLocalUser().id
        };

        try {
            this.channel.postMessage(message);
        } catch (e) {
            console.warn('[CollabChannel] 訊息發送失敗:', e);
        }
    }

    /**
     * 接收並解析通道訊息
     */
    handleMessage(event) {
        if (!event || !event.data) return;
        const { type, payload, senderId } = event.data;

        // 忽略自己發送的廣播 (原生 BroadcastChannel 預設不會收到自己的，保險防護)
        if (senderId === this.presenceManager.getLocalUser().id) return;

        switch (type) {
            case 'PRESENCE_JOIN':
            case 'PRESENCE_HEARTBEAT':
                if (payload && payload.user) {
                    this.presenceManager.handlePeerPresence(payload.user);
                    // 若收到新 Peer 加入，自己立即回傳一次心跳讓對方也能感知自己
                    if (type === 'PRESENCE_JOIN') {
                        this.send('PRESENCE_HEARTBEAT', { user: this.presenceManager.getLocalUser() });
                    }
                }
                break;

            case 'PRESENCE_LEAVE':
                if (payload && payload.userId) {
                    this.presenceManager.handlePeerLeave(payload.userId);
                }
                break;

            default:
                // 預留未來 v2.0 CRDT / Delta 訊息擴充
                if (this.eventBus) {
                    this.eventBus.emit(`COLLAB:MSG:${type}`, payload);
                }
                break;
        }
    }

    /**
     * 啟動 Presence 心跳發送
     */
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.send('PRESENCE_HEARTBEAT', { user: this.presenceManager.getLocalUser() });
        }, 3000);
    }

    /**
     * 停止心跳
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
