# Custom Objects Rules

## 1. 表格 (Table) 物件實作準則
- 網頁 Canvas 缺乏原生的 `<table>` 元素，因此需使用 Fabric.js 的 `Group` 來封裝表格結構。
- 每個儲存格由 `fabric.Rect` (背景) 與 `fabric.Textbox` (文字內容) 組成。
- `Group` 必須啟用 `subTargetCheck: true`，以允許使用者直接點擊內部文字進行編輯。
- 由於是封裝的群組，因此自適應寬高縮放時，需特別注意文字比例避免扭曲變形。
- 請為產生的群組加入 `isTable = true` 屬性標記。

## 2. 外部圖片/Logo 匯入準則
- 使用者上傳外部圖片時，應透過 `FileReader` 轉為 Base64 (DataURL)。
- 使用 `fabric.Image.fromURL` 載入畫布前，必須檢查圖片尺寸，若超過畫布工作區的 80% 應自動按比例縮小，確保不會超出畫面邊界。
- 新增至畫布的圖片必須統一置中於 `artboard` 中心，並設定 `originX: 'center'` 與 `originY: 'center'` 以符合整體的控制點邏輯。
- 所有自訂物件的控制點樣式必須與系統預設 (`applyCustomStyles`) 保持一致，即深色邊框、圓形控制點、不透明角落。

## 3. 圖片進階屬性與濾鏡 (Image Filters)
- 當選擇 `fabric.Image` 物件（且 `isQRCode` 不為 `true`）時，屬性面板必須切換為圖片專屬的 UI，避免顯示不適用的 Fill 與 Stroke 選項。
- **自由變形切換**：圖片預設應該維持等比例縮放，透過切換 `lockUniScaling` 屬性來實作「解鎖自由變形」的按鈕邏輯。
- **濾鏡套用**：實作亮度、對比、飽和度、模糊等功能時，必須統一使用 `fabric.Image.filters` 原生 API。
- 每次調整濾鏡參數後，必須呼叫 `activeObject.applyFilters()` 以及 `canvas.requestRenderAll()`，並觸發 `CANVAS:DIRTY` 事件確保歷史紀錄正確。
- **濾鏡狀態回補**：當選取不同的圖片時，必須掃描該物件現存的 `filters` 陣列，並將數值（如 brightness、contrast 等）正確倒填回 UI 的滑桿上，以保持狀態同步。

## 4. 圖片裁切 (Image Cropping)
- **非破壞性互動**：當進入裁切模式時，必須將原圖片以及畫布上其他所有物件鎖定（設定 `selectable: false`），並產生一個獨立的裁切框 (`cropRect`) 供使用者調整。
- **裁切實作方式**：為避免原生的 `cropX`/`cropY` 與縮放產生衝突，裁切確認後，應使用暫存的 HTML Canvas 繪製出選定區域，並透過 `toDataURL` 將其轉換為全新的 `fabric.Image` 物件，最後取代原始圖片。
- 新生成的裁切圖片必須繼承原圖片的屬性，包含已套用的濾鏡 (`filters`) 以及鎖定狀態 (`lockUniScaling`)。
