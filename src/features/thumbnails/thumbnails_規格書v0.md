# 縮圖面板 (ThumbnailsPanel) 開發規格書 (v0)

> **說明**：開發完成後，Agent 必須自我檢驗產出此文件，存放在 `src/features/thumbnails/` 底下。
> **建立日期**：2026-07-26 20:38:00

## 1. 規範檢視與符合程度
| 檢驗項目 | 標準規範/功能規則要求 | 實際開發狀況 | 符合程度 (Pass/Fail) |
| :--- | :--- | :--- | :--- |
| 架構位置 | 需放在 `src/features/thumbnails/` | 已建立 `ThumbnailsPanel.js` | Pass |
| 隔離原則 | 圖片工作區必須隱藏 | 監聽 `WORKSPACE:MODE_CHANGED` 並調整 `display: none` | Pass |
| 頁面管理 | 最少保留一頁限制 | 實作 `deletePage`，陣列長度 <=1 時 return | Pass |

## 2. 實作差異與優化說明
目前先實作了狀態維護 (`this.pages` 陣列) 與 EventBus 事件發送。畫面渲染 (`render`) 先保留 Console 輸出，等後續結合真實 Canvas 截圖時再串接 DOM 替換。

## 3. 🌟 測試結果與品質保證
- **測試情境 1 (工作區隱藏測試) 測試結果**：通過。接收到 `IMAGE` 模式時，面板容器成功設為 `none`。
- **測試情境 2 (刪除最後一頁) 測試結果**：通過。只剩一頁時觸發 `deletePage`，陣列不會被清空，成功防呆。

## 4. 🌟 新增環境依賴說明
- **新增的 npm 套件**：無
- **新增的環境變數 (.env)**：無
