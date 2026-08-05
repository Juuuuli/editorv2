# 系統主題與外觀設定模組 (Theme) 規則 (v0)

## 1. 模組定位
提供全局 4 大主題切換（經典手繪 `light`、深色極客 `dark`、專業冷灰 `pro-slate`、復古文青 `retro-warm`）、外觀偏好持久化存儲 (`localStorage`) 以及「系統與外觀設定」視窗 (`ThemeManager.js`)。

## 2. 核心架構與獨立資料夾結構
主題樣式採用完全獨立分割之模組化架構（位於 `src/themes/`）：
- `src/themes/index.css`：主題整合匯入入口。
- `src/themes/settings-modal/settings-modal.css`：全主題統一之深色工作站設定彈窗樣式與 4 款主題預覽卡片隔離色彩。
- `src/themes/dark-geek/dark-geek.css`：🌙 深色極客（黑曜藍、深灰面板、靛藍夜光微光）。
- `src/themes/pro-slate/pro-slate.css`：💼 專業冷灰（深石墨 Header、霧面冷灰鋁合金網格底、純白工作站卡片、冰川蔚藍）。
- `src/themes/retro-warm/retro-warm.css`：📜 復古文青（胡桃木深暖棕 Header、羊皮紙/牛皮紙燕麥底、手帳壓印陰影、焦糖琥珀金）。

## 3. 輸入與輸出
- **輸入 (Triggers)**：
  - 點擊儀表板或編輯器 Header 的「設定齒輪」按鈕。
  - 點擊設定彈窗內的主題選擇卡片。
- **輸出 (Actions & Attributes)**：
  - 更新 `document.documentElement.setAttribute('data-theme', themeId)`。
  - 寫入 `localStorage.setItem('editor_theme', themeId)`。
  - 觸發 `THEME:CHANGED` 事件通知畫布及其他模組更新輔助格線與預覽。

## 4. 邊界條件與例外處理
- **設定彈窗色彩隔離**：設定彈窗永遠維持一致的暗色工作站介面，不因使用者當前選擇的主題產生背景色或字體顏色污染。
- **降級容錯**：若 `localStorage` 中的主題無效或不存在，預設回退至 `light`。
