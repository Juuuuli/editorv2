import * as Y from 'yjs';
import { ref, push, onChildAdded, onValue, set, onDisconnect, get } from 'firebase/database';
import * as awarenessProtocol from 'y-protocols/awareness';
import { rtdb } from '../../config/firebase';

export default class FirebaseProvider {
    constructor(roomName, ydoc) {
        this.roomName = roomName;
        this.ydoc = ydoc;
        this.awareness = new awarenessProtocol.Awareness(ydoc);
        
        // Firebase References
        this.roomRef = ref(rtdb, `rooms/${roomName}/updates`);
        this.awarenessRef = ref(rtdb, `rooms/${roomName}/awareness`);
        
        // ==========================================
        // 1. Yjs Document Sync
        // ==========================================
        // 監聽本地 Yjs 改變，並推送到 Firebase
        this.updateHandler = (update, origin) => {
            if (origin !== this) {
                // 將 Uint8Array 轉為 base64 字串，大幅節省 Firebase 空間
                let binary = '';
                const len = update.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(update[i]);
                }
                const base64Update = btoa(binary);
                push(this.roomRef, base64Update);
            }
        };
        this.ydoc.on('update', this.updateHandler);

        // 監聽 Firebase 的遠端改變，並套用到本地 Yjs
        this.childAddedUnsub = onChildAdded(this.roomRef, (snapshot) => {
            const val = snapshot.val();
            if (val && typeof val === 'string') {
                const binaryString = atob(val);
                const len = binaryString.length;
                const update = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    update[i] = binaryString.charCodeAt(i);
                }
                Y.applyUpdate(this.ydoc, update, this);
            }
        });

        // ==========================================
        // 2. Awareness (Cursors & Presence) Sync
        // ==========================================
        const myAwarenessRef = ref(rtdb, `rooms/${roomName}/awareness/${this.awareness.clientID}`);
        
        // 當連線中斷時，自動刪除自己的 Awareness 狀態
        onDisconnect(myAwarenessRef).remove();

        // 監聽本地 Awareness 改變，推送到 Firebase
        this.awarenessUpdateHandler = ({ added, updated, removed }) => {
            const changedClients = added.concat(updated).concat(removed);
            const state = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
            
            let binary = '';
            const len = state.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(state[i]);
            }
            set(myAwarenessRef, btoa(binary));
        };
        this.awareness.on('update', this.awarenessUpdateHandler);

        // 監聽 Firebase 上的所有 Awareness 狀態
        this.awarenessValueUnsub = onValue(this.awarenessRef, (snapshot) => {
            const states = snapshot.val();
            if (states) {
                Object.keys(states).forEach(clientId => {
                    // 不處理自己的狀態
                    if (clientId !== String(this.awareness.clientID)) {
                        const base64State = states[clientId];
                        if (base64State && typeof base64State === 'string') {
                            const binaryString = atob(base64State);
                            const len = binaryString.length;
                            const stateArray = new Uint8Array(len);
                            for (let i = 0; i < len; i++) {
                                stateArray[i] = binaryString.charCodeAt(i);
                            }
                            awarenessProtocol.applyAwarenessUpdate(this.awareness, stateArray, this);
                        }
                    }
                });
            }
        });
    }

    async isRoomEmpty() {
        try {
            const snapshot = await get(this.roomRef);
            return !snapshot.exists();
        } catch (e) {
            console.error('[FirebaseProvider] 檢查房間狀態失敗:', e);
            return true;
        }
    }

    destroy() {
        this.ydoc.off('update', this.updateHandler);
        this.awareness.off('update', this.awarenessUpdateHandler);
        if (this.childAddedUnsub) this.childAddedUnsub();
        if (this.awarenessValueUnsub) this.awarenessValueUnsub();
        this.awareness.destroy();
    }
}
