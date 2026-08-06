# 多人協作共編模組 (Collaboration Feature Module)

> **模組版本**：v1.5.0  
> **所屬目錄**：`src/features/collaboration/`  
> **遵守規範**：[標準規範v2.md](file:///C:/EditorV2/docs/標準規範v2.md)

---

## 1. 模組職責
負責多媒體畫布編輯器的專案分享、房間邀請碼、協作者身分標識 (Presence) 以及跨視窗/跨分頁即時通訊通道。

---

## 2. 檔案清單與架構

* **`index.js`**：模組整合入口，實例化 Presence、CollabChannel 與 ShareModal。
* **`PresenceManager.js`**：維護本地與遠端 Peer 的 Presence 狀態、指派隨機專屬色彩與在線成員列表。
* **`CollabChannel.js`**：封裝原生 `BroadcastChannel`，提供單機跨分頁 (含無痕視窗) 即時心跳與事件廣播通道。
* **`ShareModal.js`**：手繪風格 (.sketch) 分享與協作彈窗，提供一鍵複製專案共編 URL、6 位數房間 PIN 碼與權限角色切換。

---

## 3. EventBus 事件註冊表

### 監聽 (Subscribe)
* `COLLAB:OPEN_SHARE_MODAL`：`{ projectId, title, roomId }` 開啟分享彈窗。
* `COLLAB:CONNECT_ROOM`：`{ projectId, roomId }` 連線至特定房間廣播通道。
* `COLLAB:DISCONNECT_ROOM`：斷開當前房間連線。
* `COLLAB:BROADCAST_PRESENCE`：`{ user }` 廣播本地 Presence 資訊。

### 發送 (Publish)
* `COLLAB:ROOM_JOINED`：`{ projectId, roomId, channelName }` 成功加入房間。
* `COLLAB:PRESENCE_UPDATE`：`{ localUser, peers, peerCount }` 在線成員名冊變更。
* `COLLAB:LOCAL_PRESENCE_UPDATED`：本地使用者身分/顏色變更。

---

## 4. UI 風格與主題相容性
* 完全採用 `.sketch` 手繪邊框與 `shadow-[3px_3px_0px_#334155]` 擬物陰影。
* 背景與文字顏色全數使用 CSS 變數與 Tailwind 主題色，自適配 Dark / Sketch / Pro / Retro 四套主題。
