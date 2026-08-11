/**
 * CollabChannel.js
 * 雙軌即時協作通訊通道 (Hybrid WebRTC P2P + BroadcastChannel)
 * 支援：
 * 1. 同瀏覽器跨分頁即時廣播 (BroadcastChannel)
 * 2. 跨瀏覽器 (Chrome <-> Edge)、無痕視窗與跨裝置 P2P 直連 (WebRTC via PeerJS)
 * 3. 專案快照握手同步 (Project Snapshot Sync)
 * 4. 協作者 Presence 心跳與在線名冊即時更新
 */

import { Peer } from 'peerjs';

export default class CollabChannel {
    constructor(eventBus, presenceManager) {
        this.eventBus = eventBus;
        this.presenceManager = presenceManager;

        this.broadcastChannel = null;
        this.peer = null;
        this.peerConnections = new Map(); // peerId -> DataConnection
        this.heartbeatTimer = null;
        this.guestRetryTimer = null;
        this.guestRetryCount = 0;

        this.projectId = null;
        this.roomId = null;
        this.isHost = false;
        this.isConnecting = false;

        this.bindEvents();
    }

    bindEvents() {
        if (this.eventBus) {
            this.eventBus.on('COLLAB:CONNECT_ROOM', (data) => {
                if (!data || !data.projectId) return;
                this.connect(data.projectId, data.roomId || data.projectId, data.isGuest || false);
            });

            this.eventBus.on('COLLAB:DISCONNECT_ROOM', () => {
                this.disconnect();
            });

            this.eventBus.on('COLLAB:BROADCAST_PRESENCE', (user) => {
                this.send('PRESENCE_HEARTBEAT', { user: user || this.presenceManager.getLocalUser() });
            });

            this.eventBus.on('COLLAB:SEND_SNAPSHOT', (data) => {
                if (!data || !data.projectData) return;
                this.send('PROJECT_SNAPSHOT', { projectData: data.projectData, projectId: this.projectId });
            });

            this.eventBus.on('COLLAB:SNAPSHOT_RECEIVED', () => {
                this.stopGuestRetry();
            });
        }

        // 監聽分頁可見度切換與焦點變更 (防止單螢幕切換視窗時瀏覽器背景休眠延遲)
        if (typeof window !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.projectId) {
                    console.log('[CollabChannel] 偵測到分頁切換回前台，自動喚醒協作連線與心跳...');
                    this.send('PRESENCE_HEARTBEAT', { user: this.presenceManager.getLocalUser() });
                    if (!this.isHost) {
                        this.requestProjectSnapshot();
                    }
                }
            });

            window.addEventListener('focus', () => {
                if (this.projectId) {
                    this.send('PRESENCE_HEARTBEAT', { user: this.presenceManager.getLocalUser() });
                }
            });

            // 頁面關閉時主動通知離線
            window.addEventListener('beforeunload', () => {
                this.send('PRESENCE_LEAVE', { userId: this.presenceManager.getLocalUser().id });
                this.disconnect();
            });
        }
    }

    /**
     * 清理字串為合法 Peer ID 格式
     */
    sanitizeId(str) {
        return (str || '').toString().toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 32);
    }

    /**
     * 連線至特定專案協作房間 (雙軌啟動 BroadcastChannel + WebRTC)
     */
    connect(projectId, roomId = projectId, isGuest = false) {
        if (this.projectId === projectId && this.roomId === roomId && (this.broadcastChannel || this.peer)) {
            return;
        }

        this.disconnect();

        this.projectId = projectId;
        this.roomId = roomId;
        this.isHost = !isGuest;

        const cleanProj = this.sanitizeId(projectId);
        const cleanRoom = this.sanitizeId(roomId);
        const channelName = `editorv2_collab_${cleanProj}_${cleanRoom}`;
        const hostPeerId = `edv2_${cleanProj}_${cleanRoom}_host`;
        const localPeerId = `edv2_${cleanProj}_${cleanRoom}_${Math.random().toString(36).substring(2, 8)}`;

        console.log(`[CollabChannel] 正在連線協作房間 -> Proj: ${projectId}, Room: ${roomId}, isHost: ${this.isHost}`);

        // 1. 啟動本機 BroadcastChannel (同瀏覽器跨分頁零延遲)
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                this.broadcastChannel = new BroadcastChannel(channelName);
                this.broadcastChannel.onmessage = (event) => this.handleIncomingMessage(event.data, 'broadcast');
            }
        } catch (e) {
            console.warn('[CollabChannel] BroadcastChannel 不可用:', e);
        }

        // 2. 啟動 WebRTC P2P 連線 (跨瀏覽器 / 無痕視窗 / 跨設備)
        this.initWebRTC(hostPeerId, localPeerId, isGuest);

        if (this.presenceManager) {
            this.presenceManager.setRoom(roomId);
        }

        // 啟動定時 Presence 心跳
        this.startHeartbeat();

        // 廣播加入訊號
        this.send('PRESENCE_JOIN', { user: this.presenceManager.getLocalUser() });

        // 若為訪客 (Guest)，啟動定時重試請求專案快照 (直到收到快照為止，最多重試 8 次)
        if (isGuest) {
            this.startGuestRetry(hostPeerId);
        }

        if (this.eventBus) {
            this.eventBus.emit('COLLAB:ROOM_JOINED', {
                projectId: this.projectId,
                roomId: this.roomId,
                isHost: this.isHost
            });
        }
    }

    /**
     * 初始化 WebRTC P2P (PeerJS)
     */
    initWebRTC(hostPeerId, localPeerId, isGuest) {
        try {
            const targetPeerId = (!isGuest) ? hostPeerId : localPeerId;

            this.peer = new Peer(targetPeerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log(`[CollabChannel-P2P] WebRTC Peer 連線成功，Peer ID: ${id}`);
                // 若為訪客，主動連線至房主 Host
                if (isGuest) {
                    this.connectToPeer(hostPeerId);
                }
            });

            // 房主接收其他協作者的連線
            this.peer.on('connection', (conn) => {
                this.setupPeerConnection(conn);
            });

            this.peer.on('error', (err) => {
                console.warn(`[CollabChannel-P2P] PeerJS 狀態/錯誤: ${err.type}`, err);
                // 若嘗試以 Host 註冊但 ID 已被佔用，自動降級為 Guest 連線至該 Host
                if (err.type === 'unavailable-id' && !isGuest) {
                    console.log(`[CollabChannel-P2P] 房主 ID 已存在，轉為協作訪客連線至: ${hostPeerId}`);
                    this.peer.destroy();
                    this.initWebRTC(hostPeerId, localPeerId, true);
                }
            });

        } catch (e) {
            console.error('[CollabChannel-P2P] 初始化 WebRTC 失敗:', e);
        }
    }

    /**
     * 訪客發起連線至房主 Peer
     */
    connectToPeer(targetPeerId) {
        if (!this.peer || this.peer.destroyed) return;

        try {
            const conn = this.peer.connect(targetPeerId, { reliable: true });
            this.setupPeerConnection(conn);
        } catch (e) {
            console.warn(`[CollabChannel-P2P] 連線至 Peer ${targetPeerId} 失敗:`, e);
        }
    }

    /**
     * 設定 Peer 連線事件與資料監聽
     */
    setupPeerConnection(conn) {
        if (!conn) return;

        conn.on('open', () => {
            console.log(`[CollabChannel-P2P] P2P 數據通道已建立: ${conn.peer}`);
            this.peerConnections.set(conn.peer, conn);

            // 互換 Presence 與資訊
            this.sendToConn(conn, 'PRESENCE_JOIN', { user: this.presenceManager.getLocalUser() });

            // 若本機需要專案快照，立即向對方索取
            if (!this.isHost) {
                this.sendToConn(conn, 'PROJECT_SYNC_REQUEST', {
                    projectId: this.projectId,
                    roomId: this.roomId,
                    requester: this.presenceManager.getLocalUser()
                });
            }
        });

        conn.on('data', (data) => {
            this.handleIncomingMessage(data, 'p2p');
        });

        conn.on('close', () => {
            console.log(`[CollabChannel-P2P] P2P 連線已中斷: ${conn.peer}`);
            this.peerConnections.delete(conn.peer);
        });

        conn.on('error', (err) => {
            console.warn(`[CollabChannel-P2P] 連線錯誤 (${conn.peer}):`, err);
            this.peerConnections.delete(conn.peer);
        });
    }

    /**
     * 訪客定時重試連線與快照請求機制
     */
    startGuestRetry(hostPeerId) {
        this.stopGuestRetry();
        this.guestRetryCount = 0;

        // 立即請求一次
        setTimeout(() => {
            this.requestProjectSnapshot();
            if (this.peer && !this.peerConnections.has(hostPeerId)) {
                this.connectToPeer(hostPeerId);
            }
        }, 500);

        // 每 2.5 秒重試一次，最多 8 次 (共 20 秒)
        this.guestRetryTimer = setInterval(() => {
            this.guestRetryCount++;
            if (this.guestRetryCount > 8) {
                this.stopGuestRetry();
                return;
            }

            console.log(`[CollabChannel-P2P] 訪客正在重新請求專案資料 (第 ${this.guestRetryCount}/8 次)...`);
            this.requestProjectSnapshot();

            if (this.peer && (!this.peerConnections.has(hostPeerId) || !this.peerConnections.get(hostPeerId).open)) {
                this.connectToPeer(hostPeerId);
            }
        }, 2500);
    }

    /**
     * 停止訪客重試計時器
     */
    stopGuestRetry() {
        if (this.guestRetryTimer) {
            clearInterval(this.guestRetryTimer);
            this.guestRetryTimer = null;
        }
    }

    /**
     * 斷開房間連線
     */
    disconnect() {
        this.stopHeartbeat();
        this.stopGuestRetry();

        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.close();
            } catch (e) {}
            this.broadcastChannel = null;
        }

        for (const conn of this.peerConnections.values()) {
            try {
                conn.close();
            } catch (e) {}
        }
        this.peerConnections.clear();

        if (this.peer) {
            try {
                this.peer.destroy();
            } catch (e) {}
            this.peer = null;
        }

        this.projectId = null;
        this.roomId = null;
        this.isHost = false;
        this.isConnecting = false;
    }

    /**
     * 主動發送專案快照請求 (同步呼叫 BroadcastChannel 與 WebRTC)
     */
    requestProjectSnapshot() {
        console.log(`[CollabChannel] 向房間協作者廣播發送專案快照請求 (PROJECT_SYNC_REQUEST)...`);
        this.send('PROJECT_SYNC_REQUEST', {
            projectId: this.projectId,
            roomId: this.roomId,
            requester: this.presenceManager.getLocalUser()
        });
    }

    /**
     * 廣播訊息至所有通道 (BroadcastChannel + 所有 WebRTC 連線)
     */
    send(type, payload = {}) {
        const message = {
            type,
            payload,
            timestamp: Date.now(),
            senderId: this.presenceManager.getLocalUser().id
        };

        // 1. 發送至 BroadcastChannel
        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage(message);
            } catch (e) {
                console.warn('[CollabChannel] Broadcast 發送失敗:', e);
            }
        }

        // 2. 發送至所有 WebRTC P2P DataConnections
        for (const conn of this.peerConnections.values()) {
            if (conn && conn.open) {
                try {
                    conn.send(message);
                } catch (e) {
                    console.warn(`[CollabChannel-P2P] 發送至 ${conn.peer} 失敗:`, e);
                }
            }
        }
    }

    /**
     * 發送訊息至特定單一 WebRTC 連線
     */
    sendToConn(conn, type, payload = {}) {
        if (!conn || !conn.open) return;
        const message = {
            type,
            payload,
            timestamp: Date.now(),
            senderId: this.presenceManager.getLocalUser().id
        };
        try {
            conn.send(message);
        } catch (e) {
            console.warn('[CollabChannel-P2P] 單點發送失敗:', e);
        }
    }

    /**
     * 接收並處理所有通訊訊息
     */
    handleIncomingMessage(data, source = 'broadcast') {
        if (!data || !data.type) return;
        const { type, payload, senderId } = data;

        // 忽略自己發出的訊息
        if (senderId === this.presenceManager.getLocalUser().id) return;

        switch (type) {
            case 'PRESENCE_JOIN':
            case 'PRESENCE_HEARTBEAT':
                if (payload && payload.user) {
                    this.presenceManager.handlePeerPresence(payload.user);
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

            case 'PROJECT_SYNC_REQUEST':
                console.log(`[CollabChannel] 收到專案快照請求 (${source}) -> 來自: ${senderId}`);
                if (this.eventBus) {
                    this.eventBus.emit('COLLAB:SYNC_REQUEST_RECEIVED', {
                        projectId: payload ? payload.projectId : this.projectId,
                        senderId
                    });
                }
                break;

            case 'PROJECT_SNAPSHOT':
                console.log(`[CollabChannel] 收到專案快照資料 (${source})！即時寫入並載入專案...`);
                if (payload && payload.projectData && this.eventBus) {
                    this.eventBus.emit('COLLAB:SNAPSHOT_RECEIVED', {
                        projectData: payload.projectData,
                        projectId: payload.projectId
                    });
                }
                break;

            default:
                if (this.eventBus) {
                    this.eventBus.emit(`COLLAB:MSG:${type}`, payload);
                }
                break;
        }
    }

    /**
     * 啟動 Presence 心跳
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

    /**
     * 斷開房間與所有連線
     */
    disconnect() {
        this.stopHeartbeat();

        if (this.broadcastChannel) {
            try {
                this.send('PRESENCE_LEAVE', { userId: this.presenceManager.getLocalUser().id });
                this.broadcastChannel.close();
            } catch (e) {
                // ignore
            }
            this.broadcastChannel = null;
        }

        for (const conn of this.peerConnections.values()) {
            try {
                conn.close();
            } catch (e) {
                // ignore
            }
        }
        this.peerConnections.clear();

        if (this.peer) {
            try {
                this.peer.destroy();
            } catch (e) {
                // ignore
            }
            this.peer = null;
        }

        this.projectId = null;
        this.roomId = null;
        this.isHost = false;
    }
}
