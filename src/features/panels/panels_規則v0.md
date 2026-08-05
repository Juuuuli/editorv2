# 側邊欄面板管理模組 (Panels) 規則 (v0)

## 1. 模組定位
協調整合左側邊欄所有子面板（工具 `panel-tools`、屬性 `panel-properties`、素材 `panel-assets`、圖層 `panel-layers`）之切換、連動與狀態更新。

## 2. 核心檔案與職責
- `PanelManager.js`：
  - 監聽上方 Tab 標籤切換點擊，協調面板顯隱。
  - 監聽 `CANVAS:OBJECT_SELECTED` 事件，自動智慧跳轉至「屬性面板」(`panel-properties`)。
  - 監聽 `UI:SWITCH_PANEL` 事件，支援跨模組主動請求切換特定分頁。
- `PropertiesPanel.js`：
  - 負責選取物件之幾何尺寸、位置、顏色、不透明度、字型、線寬、陰影等詳細參數編輯。
- `LayersPanel.js`：
  - 負責圖層堆疊順序調整 (上移/下移/置頂/置底)、可見度 (顯示/隱藏)、鎖定狀態管理。
- `AssetsPanel.js` & `AssetsManager.js`：
  - 負責使用者自訂圖庫素材之預覽、分類管理與拖曳至畫布生成物件。

## 3. 輸入與輸出
- **輸入**：
  - Tab 點擊事件。
  - `CANVAS:OBJECT_SELECTED` / `CANVAS:SELECTION_CLEARED`：選取狀態變更。
  - `UI:SWITCH_PANEL`：指定 tabId 與 panelId 進行切換。
- **輸出**：
  - 視覺 Class 切換（`hidden` / 移除 `hidden`，點亮選中 Tab 邊框與文字顏色）。
  - 對應子面板觸發 `render()` 或數據更新。

## 4. 邊界條件與例外處理
- **迴圈觸發防護**：屬性面板自身變更屬性時 (`isUpdatingFromPanel`) 不重複觸發面板重切換。
- **特定區域過濾**：選取裁切框、選取框 (`activeSelection`) 或暫時輔助圖層時不強制切換屬性面板，避免干擾使用者操作。
