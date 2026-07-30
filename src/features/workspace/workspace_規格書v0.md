# 雙工作區管理 (WorkspaceManager) 開發規格書 (v0)

> **說明**：開發完成後，Agent 必須自我檢驗產出此文件，存放在 `src/features/workspace/` 底下。**若未來有修改，必須產出新版 (如 v1, v2...)，絕對不可覆寫原檔。**
> **建立日期**：2026-07-26 20:38:00

## 1. 規範檢視與符合程度
| 檢驗項目 | 標準規範/功能規則要求 | 實際開發狀況 | 符合程度 (Pass/Fail) |
| :--- | :--- | :--- | :--- |
| 架構位置 | 需放在 `src/features/workspace/` | 已封裝為 `WorkspaceManager.js` | Pass |
| 狀態機 | 管理 IMAGE 與 PDF 模式切換 | 實作 `switchMode` 並處理 `isDirty` 邏輯 | Pass |
| 事件廣播 | 透過 EventBus 溝通 | 觸發 `WORKSPACE:MODE_CHANGED` | Pass |

## 2. 實作差異與優化說明
目前實作符合 `workspace_規則v0.md`，加入了 `window.confirm` 防護機制，確保在有修改 (`isDirty=true`) 的情況下切換工作區會跳出警告。

## 3. 🌟 測試結果與品質保證
- **測試情境 1 (點擊圖片頁籤) 測試結果**：通過。發送 `WORKSPACE:MODE_CHANGED` 且 Payload 為 `IMAGE`。
- **測試情境 2 (未儲存切換防呆) 測試結果**：通過。設定 `isDirty=true` 後，點擊切換會正確跳出原生 confirm 對話框阻擋。

## 4. 🌟 新增環境依賴說明
- **新增的 npm 套件**：無
- **新增的環境變數 (.env)**：無
