# Smart Tools (AI Features) Rules

## 1. 畫筆塗抹修補 (Brush Inpaint)
- 使用 `fabric.Canvas` 的 `isDrawingMode` 切換畫筆狀態，並且設定 `freeDrawingBrush` 的顏色與粗細 (如紅色半透明)。
- 必須監聽 `path:created` 事件來獲取使用者的塗抹軌跡 (`fabric.Path`)，該軌跡將作為 API 請求的 Mask。
- API 處理期間必須停用按鈕並顯示 Loading 狀態，完成後必須自動將該 Path 替換為修補後的圖片。

## 2. 選框處理 (Region Selection)
- 由於預設 Fabric.js 的多選框不會產生實體物件，我們使用帶有 `isRegionBox = true` 屬性的虛線 `Rect` 來記錄使用者的選取範圍。
- 所有基於區域的智慧工具 (如選框去背) 必須先判斷是否存在此 `isRegionBox` 物件。
- 處理完成後，必須將產出的圖片取代原本的 `isRegionBox`。

## 3. UI 與狀態反饋
- 所有呼叫外部或非同步操作的智慧工具，都必須實作 `setButtonLoading()` 以避免使用者重複點擊。
- 工具套用完成後，若改變了畫布內容，必須呼叫 `CanvasEngine.saveHistory()` 並發送 `CANVAS:DIRTY` 事件，以確保 Undo/Redo 歷史狀態與預覽縮圖是最新的。
