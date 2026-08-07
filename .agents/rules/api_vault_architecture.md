# 系統金鑰保險箱與模型管理架構規範 (API Vault Protocol)

> **適用模組**：`src/features/vault/`  
> **核心管理器**：`ApiVaultManager.js`  
> **建立日期**：2026-08-07  

---

## 1. 模組職責與隔離原則

1. **獨立資料夾隔離**：
   * 所有金鑰保險箱的 UI 生成、DOM 事件綁定、資料驗證與儲存邏輯，一律收納於 `src/features/vault/ApiVaultManager.js`。
   * 嚴禁將保險箱的大量 DOM 模板與狀態直接混入 `AuthManager.js`，保持登入認證與金鑰管理職責分離。

2. **跨模組通訊**：
   * 外部模組（如導覽列選單、帳號下拉選單）若需開啟保險箱，統一透過 `EventBus.emit('VAULT:OPEN_MODAL')` 呼叫。
   * 設定儲存變更時，由 `ApiVaultManager` 廣播 `EventBus.emit('VAULT:CONFIG_UPDATED', config)`，使各 AI 工具及轉檔服務即時更新當前配置。

---

## 2. 介面架構與分類標準 (3 大服務分類)

保險箱介面必須採用側邊欄分頁 (Tab-based) 設計，分為三大核心服務分類：

```text
┌─────────────────────────────────────────────────────────────┐
│ 🛡️ 系統模型設定與金鑰保險箱                                   [✕] │
├───────────────┬─────────────────────────────────────────────┤
│ 🧠 AI 核心模型 │ [內建主流 (推薦)]  [自訂端點 (vLLM/Ollama)]   │
│ (LLM 大腦)    │ 供應商選擇 (OpenAI / Anthropic)              │
│               │ API Key / Base URL / Model ID 輸入          │
├───────────────┼─────────────────────────────────────────────┤
│ 🖼️ 影像處理服務 │ 選擇供應商 (Clipdrop / Photoroom / Remove.bg)│
│ (去背與修補)   │ 影像處理專屬 API Key 輸入                    │
├───────────────┼─────────────────────────────────────────────┤
│ 📊 簡報轉檔解析 │ 選擇轉檔供應商 (ConvertAPI / Gotenberg)       │
│ (PPT 轉 PDF)  │ 轉檔服務金鑰或自建伺服器 URL                 │
├───────────────┴─────────────────────────────────────────────┤
│ 🟢 目前作用中模型: GPT-4o (內建)         [ 取消 ]  [ 儲存設定 ] │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 服務類別與預設提供商
1. **AI 核心模型 (LLM)**：
   * 內建支援：OpenAI (GPT-4o, GPT-4o-mini)、Anthropic (Claude 3.5 Sonnet)。
   * 自訂端點：相容 OpenAI API 格式之私有部署（vLLM、Ollama、企業內網端點）。
2. **影像處理服務 (Image Processing)**：
   * 支援：Clipdrop API (預設 Inpainting & Remove BG)、Photoroom API、Remove.bg、Stable Diffusion。
3. **簡報轉檔解析服務 (PPT/PDF Parsing)**：
   * 支援：ConvertAPI (預設雲端)、CloudConvert、LibreOffice Gotenberg (Docker 自建)。

---

## 3. 本地儲存與資料規格 (Storage Schema)

* **儲存鍵值 (LocalStorage Key)**：`EDITOR_V2_VAULT_CONFIG`
* **資料結構規範**：

```json
{
  "activeLlmType": "builtin",
  "builtin": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "sk-proj-..."
  },
  "custom": {
    "name": "公司內網 vLLM",
    "baseUrl": "https://api.your-company.com/v1",
    "modelId": "meta-llama/Llama-3-8B",
    "token": "..."
  },
  "imageProcessing": {
    "provider": "clipdrop",
    "apiKey": "..."
  },
  "pptParsing": {
    "provider": "convertapi",
    "secret": "..."
  },
  "updatedAt": 1786086000000
}
```

* **安全性考量**：所有金鑰僅保留於使用者的瀏覽器本機端（LocalStorage），嚴禁明文發送至公開日誌或非目標端點。

---

## 4. 主題樣式規範 (Theming)

* 保險箱彈窗必須支援系統全部 4 套主題風格（Light Sketch, Dark, Pro Slate, Retro）。
* **樣式規則**：一律使用 `settings-modal.css` 定義之語意化 Class（如 `.vault-modal-overlay`, `.vault-modal-container`, `.vault-tab-btn`, `.vault-input`），禁止直接 hardcode 寫死單一主題背景色。
