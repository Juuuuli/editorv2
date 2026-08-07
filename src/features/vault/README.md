# 系統模型與金鑰保險箱模組 (API Vault Module)

> **所屬路徑**：`src/features/vault/`  
> **主要管理者**：`ApiVaultManager.js`  

---

## 1. 模組職責
* 集中管理 AI 核心模型 (LLM)、影像去背與修補 (Image Processing) 及簡報轉檔解析 (PPT/PDF Parsing) 之 API 金鑰與自訂伺服器端點。
* 提供手繪與多主題相容之多分頁設定彈窗 (Tab-based Modal)。
* 負責本機 LocalStorage (`EDITOR_V2_VAULT_CONFIG` 與相容舊版之 `editor_api_vault`) 資料持久化。

---

## 2. EventBus 事件清單

### 監聽事件 (Listens to)
* `VAULT:OPEN_MODAL` (或 `API_VAULT:OPEN`)：開啟保險箱彈窗，支援傳入 `{ tab: 'llm' | 'image' | 'ppt' }`。

### 發送事件 (Emits)
* `VAULT:CONFIG_UPDATED`：當使用者儲存設定時廣播全域最新配置物件。
* `API_VAULT:UPDATED`：向下相容舊版工具之廣播事件。

---

## 3. 對外暴露介面
* `open(options)`：開啟彈窗。
* `close()`：關閉彈窗。
* `loadConfig()`：讀取當前有效設定。
* `saveConfig(newConfig)`：儲存並廣播設定。
