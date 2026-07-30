# 智慧工具模組規則 (v0)

## 1. 模組定位
負責左側「智慧去背與修補」類別下的所有高階工具，包含：一鍵去背、塗抹修補、選框去背、智慧修補、智慧辨識(OCR)、純色覆蓋。此模組高度依賴外部 API。

## 2. 單一職責分離 (實體檔案配置)
每項工具必須是獨立的 JS 檔：
- `AutoRemoveBgTool.js` (一鍵去背)
- `SmudgeInpaintTool.js` (塗抹修補)
- `MarqueeRemoveBgTool.js` (選框去背)
- `SmartInpaintTool.js` (智慧修補)
- `OCRTool.js` (智慧辨識)
- `SolidFillTool.js` (純色覆蓋)

## 3. 輸入與輸出
- **輸入 (共通)**：滑鼠於畫布上的拖曳框選座標 (x, y, w, h)，或是畫筆塗抹的路徑資料。
- **輸出 (共通)**：將目標座標/路徑結合當前畫布底圖，轉為 base64 或 Blob，透過 `APIClient.js` 發送 POST 請求。
- **結果處理**：接收 API 回傳的處理後影像，並向 EventBus 發送 `CANVAS:ADD_IMAGE` 或 `CANVAS:REPLACE_BACKGROUND` 事件更新畫布。

## 4. 防呆與邊界條件
1. **全局鎖定機制**：
   此資料夾下的所有工具，在啟動前必須向 `StorageManager` 或狀態中心確認 `hasImportedFile === true`。若否，按鈕必須在 UI 上維持 Disabled 樣式，點擊無效。
2. **非同步載入狀態 (Loading State)**：
   呼叫 API 時，必須在畫布中央或按鈕上顯示明顯的 Loading 動畫，並在此期間**鎖定所有其他工具**的操作（透過發送 `UI:SET_LOADING` 事件），防止使用者連續點擊發送重複請求。
3. **錯誤處理 (Fallback)**：
   若 API 發生 Timeout 或 500 錯誤，必須取消 Loading 狀態，並在畫布上方跳出紅色的錯誤 Toast 提示。
