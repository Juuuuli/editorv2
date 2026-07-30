# Global State & Project Management Rules

## 1. Undo/Redo 實作準則
- 必須於 `CanvasEngine.js` 集中管理 `historyStack` 與 `redoStack`。
- 不要在每次微小拖曳時儲存歷史，而是監聽 Fabric.js 的 `object:added`, `object:modified`, `object:removed` 等操作完成後再觸發。
- 歷史狀態儲存時必須序列化所有客製化屬性 (如 `layerName`, `isQRCode`, `qrOptions` 等)，確保還原時狀態一致。
- 載入狀態期間必須開啟 `isHistoryProcessing` 旗標，避免觸發無窮迴圈的歷史儲存。

## 2. 專案匯入匯出
- 專案資料結構必須具備版本號 (`version`)、當前頁面 (`currentPageId`) 以及完整狀態 (`pageStates`)。
- 匯出為 JSON 時必須使用 `encodeURIComponent` 以免中文字元在 Data URI 中產生亂碼。
- 匯入後應觸發 `PROJECT:IMPORTED` 與 `PAGE:SWITCH` 事件，確保各面板同步更新其內部狀態。

## 3. 多頁面 (Thumbnails)
- 頁面狀態與畫布切換邏輯由 `CanvasEngine` 與 `ThumbnailsPanel` 共同維護。
- 當切換工作區模式時，若非 PDF/Presentation 模式，應隱藏縮圖清單以保留介面整潔。
