# API 通訊共用模組規則 (v0)

## 1. 模組定位
統一封裝所有的外部 API HTTP 請求 (如 PPT 轉 PDF、智慧修補 API)，並集中讀取 `.env` 變數。

## 2. 輸入與輸出
- **輸入**：各智慧工具模組傳入的參數 (File Blob, Base64, Box Coordinates 等)。
- **輸出**：回傳 Promise 解析後的圖檔或 JSON 數據。

## 3. 邊界條件與例外處理
- **Timeout 處理**：所有外部 API 請求必須設定最長 15 秒的 Timeout 限制。超過時間自動 abort 並拋出錯誤給上層工具。
- **重試機制 (Retry)**：遇到 HTTP 500 或 503 等伺服器錯誤時，自動進行最多 1 次的重試 (間隔 2 秒)。
- **Key 保護**：若初始化時偵測不到 `.env` 中的 API Key，則在 Console 印出警告，並將所有依賴 API 的工具按鈕強迫轉為 Disabled 狀態。
