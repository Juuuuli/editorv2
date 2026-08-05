# 專案儲存引擎模組 (Storage) 規則 (v0)

## 1. 模組定位
基於瀏覽器原生 `IndexedDB` 提供可靠、高效能的本機持久化資料庫引擎 (`ProjectStorageEngine.js`)，負責專案檔案的完整 CRUD、多頁畫布狀態序列化、縮圖快照存儲與標準 `.editorproj` 專案檔匯入匯出。

## 2. 資料結構與標準
- **資料庫名稱**：`EditorV2_ProjectsDB` (Version: 1)
- **儲存物件庫 (Store)**：`projects` (KeyPath: `id`)
- **專案結構 (Schema)**：
  ```json
  {
    "id": "proj_1700000000000_abcd",
    "name": "未命名專案",
    "type": "image", // "image" | "pdf"
    "aspectRatio": "1:1",
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000,
    "thumbnail": "data:image/jpeg;base64,...",
    "pages": [
      {
        "id": "page-1",
        "title": "第 1 頁",
        "canvasData": { "objects": [...], "background": "#ffffff" },
        "thumbnail": "data:image/jpeg;base64,..."
      }
    ]
  }
  ```

## 3. 核心 API 方法
- `getAllProjects()`: 讀取所有專案並依 `updatedAt` 降冪排序。
- `getProject(id)`: 依專案 ID 取得單一專案完整多頁資料。
- `saveProject(projectData)`: 儲存或更新專案資料，自動維護時間戳記。
- `deleteProject(id)`: 刪除指定專案。
- `duplicateProject(id)`: 複製指定專案並產生新 ID。
- `exportProjectFile(id)`: 導出標準 JSON 結構並命名為 `[專案名稱].editorproj`。
- `importProjectFile(file)`: 解析上傳的 `.editorproj` 檔案並儲存入 IndexedDB。

## 4. 邊界條件與例外處理
- **版本相容與自動升級**：若讀取的舊版專案為單頁結構，自動封裝為 `pages` 多頁陣列結構。
- **快照壓縮**：產生儲存縮圖時採用 JPEG 0.7 壓縮，節省 IndexedDB 佔用容量。
- **事務回滾與防護**：讀寫操作包含 Promise 包裝與嚴格的 `onerror` 捕捉，避免資料庫損毀。
