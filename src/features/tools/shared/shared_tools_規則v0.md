# 工具共用邏輯與快捷鍵模組 (Shared Tools & Shortcuts) 規則 (v0)

## 1. 模組定位
提供跨工具共用的操作邏輯、畫布歷史紀錄堆疊 (`Undo / Redo`)、剪貼簿 (`Copy / Paste`)、群組化 (`Group / Ungroup`) 以及全局快捷鍵監聽 (`KeyboardShortcuts.js`)。

## 2. 核心快捷鍵與支援清單
- `Delete` / `Backspace`：刪除當前選取之物件。
- `Ctrl + Z`：復原 (Undo)。
- `Ctrl + Y` / `Ctrl + Shift + Z`：重做 (Redo)。
- `Ctrl + C`：複製選取物件至內部剪貼簿。
- `Ctrl + V`：貼上物件（自動微幅平移座標 +20px，避免完全重疊）。
- `Ctrl + G`：將複選物件建立群組 (Group)。
- `Ctrl + Shift + G`：解散選取的群組 (Ungroup)。
- `Ctrl + D`：快速原地原地複製並選取副本 (Duplicate)。
- `Ctrl + A`：全選當前頁面所有可編輯物件。
- `方向鍵 (↑ ↓ ← →)`：微移選取物件 (支援 Shift 加速移動)。

## 3. 歷史紀錄管理 (History Stack)
- 監聽 `CANVAS:OBJECT_MODIFIED`、`CANVAS:OBJECT_ADDED`、`CANVAS:OBJECT_REMOVED` 自動記錄快照。
- 快照數量上限限制（預設 30 步），防止大量操作導致記憶體過度膨脹。
- 復原/重做期間標記 `isRestoring = true`，避免自身狀態觸發新歷史紀錄。

## 4. 邊界條件與例外處理
- **輸入框防護**：當焦點在 `INPUT`、`TEXTAREA` 或 `contenteditable` 文字編輯區時，自動忽略所有快捷鍵，避免干擾使用者正常打字。
- **唯讀/鎖定物件防護**：鎖定圖層或唯讀物件不得被剪下、刪除或移動。
