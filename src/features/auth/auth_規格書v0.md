# 角色帳號與身分認證系統規格書 (Auth & RBAC Specification v0)

## 1. 系統架構圖 (Architecture Overview)

```text
[ 使用者訪客 ] ──> [ 未登入攔截 Gate ]
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
    [ 帳號密碼登入 ]                 [ 註冊新帳號 (RBAC) ]
    (預設: admin_master / Admin@Canvas2026#ProSecure!)  (Admin / Editor / Viewer)
        │                                 │
        └────────────────┬────────────────┘
                         ▼
             [ AuthManager.js 會話管理 ]
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
[ Header 使用者頭像 ] [ 系統金鑰保險箱 ]  [ IndexedDB 專案存取 ]
```

## 2. 資料結構定義 (Data Models)

### 2.1 User Entity (`editorv2_users_db`)
```typescript
interface UserAccount {
  id: string;          // 唯一識別碼，如 "user_master_admin"
  username: string;    // 帳號 (不分大小寫比對)
  password: string;    // 本地密碼
  name: string;        // 顯示名稱
  email?: string;      // 聯絡電子郵件
  role: 'admin' | 'editor' | 'viewer'; // RBAC 角色
  avatarColor: string; // 頭像背景色
  createdAt: number;   // 建立時間戳記
}
```

### 2.2 API Vault Entity (`editorv2_api_vault`)
```typescript
interface ApiVaultConfig {
  clipdropKey: string;      // Clipdrop 影像 AI 金鑰
  convertApiKey: string;    // ConvertAPI PPT/PPTX 轉檔 Secret
  sparkEndpoint: string;    // Spark 模型伺服器端點
  sparkAppId: string;       // Spark APP ID
  sparkApiKey?: string;     // Spark API Key
  sparkApiSecret?: string;  // Spark API Secret
  updatedAt: number;        // 最後更新時間戳記
}
```

## 3. UI 元件與互動規範
1. **登入彈窗 (`#auth-gate-modal`)**：
   - 居中彈窗、手繪風格外框、微透明毛玻璃遮罩。
   - 提供「⚡ 一鍵填入公用管理者」醒目快速操作按鈕。
   - 支援 `Enter` 鍵快速提交表單。
2. **使用者選單 Widget**：
   - 圓形英文首字母彩色頭像與使用者名稱。
   - 下拉選單提供「系統金鑰保險箱」、「外觀與風格設定」、「切換帳號 / 登出」。
3. **系統金鑰保險箱 (`#api-vault-modal`)**：
   - 安全遮罩密碼輸入框、即時儲存反饋提示。
