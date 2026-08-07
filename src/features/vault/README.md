# 系統模型與金鑰保險箱模組 (API Vault Module)

> **所屬路徑**：`src/features/vault/`  
> **主要管理者**：`ApiVaultManager.js`  

---

## 1. 模組職責
* 集中管理 AI 核心模型（Google Gemini 2.0/1.5 Flash、OpenAI GPT-4o/4o-mini、自訂 vLLM/Ollama 端點）、影像去背與修補 (Clipdrop) 及簡報轉檔解析 (ConvertAPI) 之金鑰與伺服器端點。
* 提供手繪與多主題相容之多分頁設定彈窗 (Tab-based Modal)。
* 提供「一鍵連線測試 (Test Ping)」功能，即時驗證各金鑰與端點回應速度與有效性。
* 負責本機 LocalStorage (`EDITOR_V2_VAULT_CONFIG` 與向下相容舊版之 `editor_api_vault`) 資料持久化。

---

## 2. EventBus 事件清單

### 監聽事件 (Listens to)
* `VAULT:OPEN_MODAL` (或 `API_VAULT:OPEN`)：開啟保險箱彈窗，支援傳入 `{ tab: 'llm' | 'image' | 'ppt' }`。

### 發送事件 (Emits)
* `VAULT:CONFIG_UPDATED`：當使用者儲存設定時廣播全域最新配置物件。
* `API_VAULT:UPDATED`：向下相容舊版工具之廣播事件。

---

## 3. 支援提供商與連線測試規格

| 類別 | 支援提供商 / 模型 | 認證格式 | 連線測試機制 |
| :--- | :--- | :--- | :--- |
| **內建主流 AI** | Google Gemini (`gemini-2.0-flash`, `gemini-1.5-flash`), OpenAI (`gpt-4o-mini`, `gpt-4o`) | API Key | GET 輕量模型列表探測 (`/models`)，測量 RTT 毫秒數 |
| **自訂 AI 端點** | vLLM, Ollama, Groq, OpenRouter, 私有伺服器 | Bearer Token / Key | GET `${baseUrl}/models` 探測 |
| **影像去背與修補** | Clipdrop API | x-api-key | POST 探測授權有效性 |
| **簡報轉檔解析** | ConvertAPI | Secret | GET `https://v2.convertapi.com/user` 取得剩餘秒數與帳號狀態 |

---

## 4. 對外暴露介面
* `open(options)`：開啟彈窗。
* `close()`：關閉彈窗。
* `loadConfig()`：讀取當前有效設定。
* `saveConfig(newConfig)`：儲存並廣播設定。
* `handlePing(target)`：執行指定服務連線測試。
