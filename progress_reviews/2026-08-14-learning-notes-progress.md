# 專案進度交接文檔 (Project Handover)

> **給下一個 Agent 的重要指示 (Read Me First):**
> 1. 此專案為 EditorV2 的**系統架構學習筆記 (Learning Notes)**，獨立於主編輯器專案之外。
> 2. 目錄位於 `C:\EditorV2\learning-notes\`。

## 1. 目前開發階段與計畫 (Current Phase)
- **整體計畫進度**: **架構學習筆記整理與功能擴充**。已將原本肥大的單一 `學習筆記.html` 進行模組化拆分，並成功加入互動式的本地筆記功能。
- **已完成事項**:
  - [x] **Wiki Tooltip 功能**：滑鼠懸停專有名詞時會彈出解釋框。
  - [x] **Mermaid 延遲渲染修復**：修復了因 Tab 隱藏 (`display: none`) 導致 Mermaid SVG 計算為 0x0 寬高的問題，改用切換 Tab 時動態渲染。
  - [x] **移除會失敗的 Mermaid 圖表**：將無法渲染的流程圖改為直接顯示 JavaScript 原始碼區塊，符合使用者期望。
  - [x] **專案結構拆分**：將超過 1700 行的 HTML 拆分為 `index.html`, `css/style.css`, `js/app.js`。
  - [x] **本機筆記系統 (Notes Engine)**：實作 `js/notes.js`，允許使用者反白選取文字後新增筆記，透過 `localStorage` 儲存，並運用 `TreeWalker` 自動在重整後將文字高亮為 `<mark>`。
- **正在進行中 (WIP)**:
  - 功能皆已實裝並通過使用者確認，目前屬於穩定階段。
- **最新工作路徑 (Latest Work)**: 
  - `C:\EditorV2\learning-notes\index.html` (主頁面骨架)
  - `C:\EditorV2\learning-notes\js\notes.js` (筆記核心邏輯)

## 2. 專案資料夾結構 (Directory Structure)
```text
C:\EDITORV2\LEARNING-NOTES
|   index.html          [重構] 從單一巨大檔案拆分出的 HTML 骨架
|   
+---css
|       style.css       [新增] 包含 Tailwind 樣式與筆記系統的 UI 樣式
|       
\---js
        app.js          [新增] 包含 Tab 切換、Wiki Tooltip 與 Prism.js 初始化
        notes.js        [新增] localStorage 筆記儲存、反白選取與 TreeWalker 高亮還原
```
- **新增/修改檔案標註**: 
  - `[新增]` `learning-notes/*` 整個目錄皆為本次全新重構產出。
  - `[刪除/廢棄]` 原本的 `C:\EditorV2\學習筆記.html` 已被取代。

## 3. 前次進度繼承 (Previous Context)
- **Mermaid 渲染注意事項**：Mermaid 10 若在 `display: none` 的容器內進行初始化，會產生寬高皆為 0 的 SVG（導致畫面空白）。必須在 `mermaid.initialize` 設定 `startOnLoad: false`，並在元素顯示（`display: block`）後再呼叫 `mermaid.run()` 進行渲染。同時需傳入 `darkMode: false` 以避免它受到作業系統深色模式影響導致顏色異常。
- **文字選取與高亮**：`notes.js` 中使用 `window.getSelection()` 獲取使用者選取範圍，並透過 `TreeWalker` 在 DOM 中尋找特定字串以還原 `<mark>` 標記。此方法適用於靜態文件，但若文字跨越 HTML 標籤可能會有潛在限制，目前實作可滿足基本需求。
