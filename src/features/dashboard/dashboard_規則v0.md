# 儀表板與專案管理模組 (Dashboard) 規則 (v0)

## 1. 模組定位
提供首頁專案管理總覽儀表板 (`DashboardManager.js`)，支援建立新專案、搜尋過濾、匯入外部專案/簡報/PDF/圖檔、專案卡片選單 (重新命名/複製/匯出/刪除) 以及多頁專案的快速切換。

## 2. 核心檔案與職責
- `src/features/dashboard/DashboardManager.js`：
  - 管理首頁視圖 (`#dashboard-view`) 與編輯器視圖 (`#editor-view`) 之間的切換。
  - 渲染本機專案網格清單與即時搜尋/分類篩選。
  - 提供新建專案彈窗（支援多種比例預設：1:1、4:3、16:9、A4 等）。
  - 整合 `ProjectStorageEngine`，負責畫布異動時的防抖 (Debounce 800ms) 自動存檔與儲存狀態標記。

## 3. 輸入與輸出
- **輸入 (Triggers)**：
  - 點擊「新建專案」、「匯入檔案」、「搜尋輸入」。
  - 點擊專案卡片進入編輯器 (`openProject(id)`)。
  - 點擊 Header「返回首頁」(`closeProjectToDashboard()`)。
  - 畫布異動事件 (`CANVAS:DIRTY`, `PAGE:SWITCH`, `PAGE:ADD`, `PAGE:DELETE`, `PAGE:COPY`)。
- **輸出 (UI & Storage)**：
  - 呈現最新專案卡片網格與縮圖。
  - 切換視圖 DOM 並調用 `ProjectStorageEngine.saveProject()` 自動持久化。

## 4. 邊界條件與例外處理
- **空狀態呈現 (Empty State)**：初次使用或查無專案時，顯示友善的插畫與引導建立新專案按鈕。
- **防止併發存檔衝突**：透過防抖計時器合併頻繁的畫布修改，確保 IndexedDB 寫入順暢無阻。
