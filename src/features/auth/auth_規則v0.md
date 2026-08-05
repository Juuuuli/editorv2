# 角色帳號與權限管理模組 (Auth & RBAC) 規則 (v0)

## 1. 模組定位
提供使用者身分驗證（登入 / 註冊）、會話持久化管理 (`Session / LocalStorage`)、角色權限分級 (RBAC: Admin / Editor / Viewer)、右上角使用者狀態選單，以及系統金鑰保險箱 (`API Vault`) 集中管理。

## 2. 預設帳號與憑證規範
- **公用最高管理者 (Master Admin)**：
  - **帳號**：`admin_master` (亦支援相容別名 `admin`)
  - **密碼**：`Admin@Canvas2026#ProSecure!` (長度 25 碼，包含大小寫英數與特殊符號)
  - **角色**：`👑 最高管理者 (admin)`
  - **定位**：作為現階段團隊內部測試與系統全局控制的最高權限通行證。
- **角色階層 (RBAC Roles)**：
  1. `admin` (最高管理者)：擁有所有專案編輯、系統外觀設定、金鑰保險箱設定等完整權限。
  2. `editor` (協作者)：具備專案建立、畫布編輯、多頁管理、檔案匯出權限。
  3. `viewer` (檢視者)：僅可檢視畫布與專案縮圖，禁止破壞性異動。

## 3. 登入介面多風格與主題連動
- **4 大主題適配**：登入彈窗全面適配 `經典手繪 (light)`、`深色極客 (dark)`、`專業冷灰 (pro-slate)`、`復古文青 (retro-warm)`。
- **登入介面即時切換**：登入彈窗提供風格切換工具列，未登入前即可直接切換體驗不同風格。
- **全域連動**：切換主題即刻同步至全域 `[data-theme]`，登入成功後直接繼承該主題。

## 4. 輸入與輸出
- **輸入 (Triggers)**：
  - 未登入時觸發全螢幕遮罩彈窗 (`#auth-gate-modal`)。
  - 登入表單提交 (`form-auth-login`)。
  - 登入介面風格即時切換 (`#auth-theme-switcher`)。
  - 點擊「系統金鑰保險箱 (API Vault)」開啟設定。
- **輸出 (Actions & Storage)**：
  - 寫入 `editorv2_current_user` (Session / LocalStorage) 與 `editorv2_users_db`。
  - 發布事件：`AUTH:LOGIN_SUCCESS`, `AUTH:REGISTER_SUCCESS`, `AUTH:LOGOUT`, `API_VAULT:UPDATED`, `THEME:SET`。
  - 即時更新 Dashboard 與 Editor Header 右上角之使用者頭像、名稱、角色徽章與控制選單。

## 5. 邊界條件與例外處理
- **未登入攔截防護**：若未登入，禁止繞過登入彈窗操作畫布或專案資料。
- **註冊通道安全鎖定**：公開狀態下註冊通道鎖定並提示維護中，防止未授權人員註冊進入。
- **自動補回管理員帳號**：若本機 Storage 遭清空或重設，系統啟動時自動檢查並重建預設最高管理者帳號。
- **金鑰隔離**：API 金鑰保險箱存放於本機 `localStorage`，不隨專案檔案匯出外洩。
