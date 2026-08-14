/**
 * PresenceManager.js
 * 協作者身分與 Presence 狀態管理器
 * 負責分配協作者顏色標籤、維護在線成員清單與發送 Presence 心跳
 */

export const PRESENCE_COLORS = [
    { bg: '#06b6d4', text: '#ffffff', name: '青綠' },
    { bg: '#ec4899', text: '#ffffff', name: '粉紅' },
    { bg: '#8b5cf6', text: '#ffffff', name: '紫色' },
    { bg: '#10b981', text: '#ffffff', name: '翡翠' },
    { bg: '#f59e0b', text: '#ffffff', name: '琥珀' },
    { bg: '#3b82f6', text: '#ffffff', name: '亮藍' },
    { bg: '#14b8a6', text: '#ffffff', name: '松石' },
    { bg: '#f43f5e', text: '#ffffff', name: '玫瑰' },
    { bg: '#6366f1', text: '#ffffff', name: '靛藍' }
];

export default class PresenceManager {
    constructor(eventBus, authManager = null) {
        this.eventBus = eventBus;
        this.authManager = authManager;

        this.localUser = this.generateLocalUser();
        this.onlinePeers = new Map(); // peerId -> peerData
        this.currentRoomId = null;

        if (this.eventBus) {
            this.eventBus.on('COLLAB:CONNECT_ROOM', (data) => {
                if (data && data.isOwner) {
                    this.updateLocalUser(null, 'owner'); // 專案擁有者
                } else if (data && data.isOwner === false) {
                    const urlRole = new URLSearchParams(window.location.search).get('role');
                    let newRole = 'editor';
                    if (urlRole === 'viewer') {
                        newRole = 'viewer';
                    }
                    this.updateLocalUser(null, newRole);
                }
            });
        }

        console.log(`[PresenceManager] 本地使用者 Presence 建立: ${this.localUser.name} (${this.localUser.color.bg})`);
    }

    /**
     * 產生本地使用者 Presence 識別資訊
     */
    generateLocalUser() {
        let authUser = null;
        if (this.authManager && typeof this.authManager.getCurrentUser === 'function') {
            authUser = this.authManager.getCurrentUser();
        }

        // 讀取網址的 role 參數
        let urlRole = 'editor';
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            if (searchParams.get('role') === 'viewer') {
                urlRole = 'viewer';
            }
        }

        // 決定初始角色 (稍後 COLLAB:CONNECT_ROOM 觸發時會依據 isOwner 再進行精確修正)
        let role = urlRole === 'viewer' ? 'viewer' : 'editor';

        // 隨機選取顏色
        const color = PRESENCE_COLORS[Math.floor(Math.random() * PRESENCE_COLORS.length)];
        const randomId = 'user_' + Math.random().toString(36).substring(2, 9);
        const name = authUser ? (authUser.name || authUser.username) : `協作者 ${Math.floor(1000 + Math.random() * 9000)}`;

        return {
            id: randomId,
            name: name,
            role: role,
            color: color,
            joinedAt: Date.now(),
            isLocal: true
        };
    }

    /**
     * 更新當前本地使用者名稱或角色
     */
    updateLocalUser(name, role = null) {
        if (name) this.localUser.name = name;
        if (role) this.localUser.role = role;

        if (this.eventBus) {
            this.eventBus.emit('COLLAB:LOCAL_PRESENCE_UPDATED', this.localUser);
        }
    }

    /**
     * 設定或更換協作房間
     */
    setRoom(roomId) {
        this.currentRoomId = roomId;
        this.onlinePeers.clear();
        this.broadcastPresence();
    }

    /**
     * 接收遠端 Peer 的 Presence 訊號
     */
    handlePeerPresence(peerData) {
        if (!peerData || !peerData.id || peerData.id === this.localUser.id) return;

        const isNew = !this.onlinePeers.has(peerData.id);
        this.onlinePeers.set(peerData.id, {
            ...peerData,
            lastSeen: Date.now(),
            isLocal: false
        });

        if (this.eventBus) {
            this.eventBus.emit('COLLAB:PRESENCE_UPDATE', {
                localUser: this.localUser,
                peers: this.getAllOnlineUsers(),
                peerCount: this.onlinePeers.size + 1,
                joinedPeer: isNew ? peerData : null
            });
        }
    }

    /**
     * 處理 Peer 離開
     */
    handlePeerLeave(peerId) {
        if (this.onlinePeers.has(peerId)) {
            const leftPeer = this.onlinePeers.get(peerId);
            this.onlinePeers.delete(peerId);

            if (this.eventBus) {
                this.eventBus.emit('COLLAB:PRESENCE_UPDATE', {
                    localUser: this.localUser,
                    peers: this.getAllOnlineUsers(),
                    peerCount: this.onlinePeers.size + 1,
                    leftPeer: leftPeer
                });
            }
        }
    }

    /**
     * 廣播本地 Presence
     */
    broadcastPresence() {
        if (this.eventBus) {
            this.eventBus.emit('COLLAB:BROADCAST_PRESENCE', this.localUser);
        }
    }

    /**
     * 取得所有在線成員 (包含自己)
     */
    getAllOnlineUsers() {
        const list = [this.localUser];
        for (const peer of this.onlinePeers.values()) {
            list.push(peer);
        }
        return list;
    }

    getLocalUser() {
        return this.localUser;
    }
}
