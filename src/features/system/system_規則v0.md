# 系統輔助與提示模組 (System & Helper) 規則 (v0)

## 1. 模組定位
提供全局環境操作提示、自訂 Tooltip 浮動提示框 (`sketch-tooltip`) 以及工具模式切換時的狀態回饋 (`ContextualHelper.js`)。

## 2. 核心檔案與職責
- `src/features/system/ContextualHelper.js`：
  - 管理全局浮動工具提示 (`Tooltip`)，為各工具按鈕提供易讀的中文說明。
  - 監聽 `UI:TOOL_CHANGED` 工具切換事件（選取/筆刷/文字/表格/QR/去背/修補/OCR 等）。
  - 監聽 `APP:STATUS_UPDATE` 事件，接收全局操作狀態通知。

## 3. 輸入與輸出
- **輸入**：
  - 滑鼠移入帶有 `title` 或指定 ID 之按鈕（`mouseenter` / `mouseleave`）。
  - `UI:TOOL_CHANGED` / `APP:STATUS_UPDATE` 事件。
- **輸出**：
  - 動態計算滑鼠與按鈕相對座標，呈現符合當前風格的浮動 Tooltip。

## 4. 邊界條件與例外處理
- **畫面邊界碰撞偵測**：浮動提示框在靠近螢幕邊界時自動翻轉或平移，避免被邊框遮蔽。
- **快速劃過防抖**：滑鼠快速劃過多個按鈕時清除前一次計時器，避免提示框殘留。
