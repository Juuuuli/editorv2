# 專案進度交接文檔 (Project Handover)

> **給下一個 Agent 的重要指示 (Read Me First):**
> 1. 請務必優先讀取並嚴格遵守 `C:\EditorV2\.agents\rules` 裡面的所有內容。
> 2. 此專案為 EditorV2 的**系統架構學習筆記 (Learning Notes)** 專屬紀錄檔，獨立於主編輯器專案之外。
> 3. 目錄位於 `C:\EditorV2\learning-notes\`。

## 1. 目前開發階段與計畫 (Current Phase)
- **整體計畫進度**: **架構學習筆記互動功能擴充與內容同步**。本次 Sprint 主要提升了筆記系統的 UI 互動性（如跳轉特效與 Hover 顯示），並將主專案近期的 `y-websocket` 架構更動同步更新至筆記文件中。
- **已完成事項**:
  - [x] **系統總覽資料探索 (Stats Modal)**：新增 `js/stats-detail.js`，點擊總覽數據卡片可彈出 Modal，完整列出 32 個原始碼模組與依賴。
  - [x] **精準跳轉與閃爍特效 (Flash Jump)**：實作自動搜尋模組關鍵字功能，點擊清單項目不僅會切換頁籤，還會精準捲動至目標元素並加上「綠色閃爍兩次」(`flash-highlight`) 的視覺回饋特效。
  - [x] **同步更新建置與架構說明**：更新 `index.html` 內的「建置與部署」與「專案目錄結構」區塊，納入 `y-websocket-server` 獨立專案、`.env.production`，並更正 Firebase 已解耦同步機制的說明與架構圖。
  - [x] **筆記內容懸浮提示 (Note Tooltip)**：在 `js/notes.js` 中為反白高亮的 `<mark>` 加上 Hover 監聽，共用 `.wiki-tooltip` 樣式，讓使用者將滑鼠移過即可直接閱讀筆記內容，點擊則一樣可展開右側面板進行編輯。
- **正在進行中 (WIP)**:
  - 功能皆已實裝並通過使用者確認，目前屬於穩定階段。
- **最新工作路徑 (Latest Work)**: 
  - `C:\EditorV2\learning-notes\index.html` (更新文件內容)
  - `C:\EditorV2\learning-notes\js\stats-detail.js` (新增的數據卡片互動邏輯)
  - `C:\EditorV2\learning-notes\js\notes.js` (新增 Tooltip 邏輯)
  - `C:\EditorV2\learning-notes\css\style.css` (新增 Modal 與 Flash 動畫樣式)

## 2. 專案資料夾結構 (Directory Structure)
```text
C:\EDITORV2\LEARNING-NOTES
|   index.html          [修改] 更新了架構圖、目錄樹與模組說明
|   
+---css
|       style.css       [修改] 新增 .stats-modal 與 .flash-target 動畫
|       
\---js
        app.js          [無變動]
        notes.js        [修改] 加入 .note-tooltip 懸浮提示功能
        stats-detail.js [新增] 負責總覽卡片的點擊展開與精準跳轉邏輯
```
- **新增/修改檔案標註**: 
  - `[新增]` `js/stats-detail.js`：透過迴圈與 `includes(keyword)` 動態尋找目標元素以實現精準捲動。
  - `[修改]` `index.html` 中的資料流總結與樹狀圖已更新至支援 Yjs Weboscket 架構 (v1.5)。

## 3. 前次進度繼承 (Previous Context)
- **精準跳轉 (DOM Search) 技巧**：在 `stats-detail.js` 中，為了不修改大量原始 HTML 添加 ID，我們採用擷取字首英文（如 `BasicTools.js` 取 `BasicTools`）作為 Keyword，並在目標 Section 內使用 `querySelectorAll('.card, .sub-title')` 去 `textContent.includes(keyword)` 尋找目標，實證這是一種高彈性且無侵入性的做法。
- **Mermaid 渲染注意事項**：必須在 `mermaid.initialize` 設定 `startOnLoad: false`，並在元素顯示（`display: block`）後再呼叫 `mermaid.run()` 進行渲染。
- **文字選取與高亮**：`notes.js` 中使用 `window.getSelection()` 獲取使用者選取範圍，並透過 `TreeWalker` 在 DOM 中尋找特定字串以還原 `<mark>` 標記。此方法適用於靜態文件。
