/**
 * ProjectStorageEngine.js
 * 專案本機持久化儲存引擎 (IndexedDB)
 * 負責所有專案的建立、讀取、更新、刪除 (CRUD)、縮圖儲存與匯入匯出
 */

export default class ProjectStorageEngine {
    constructor() {
        this.dbName = 'EditorV2_ProjectsDB';
        this.storeName = 'projects';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    objectStore.createIndex('type', 'type', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('[ProjectStorageEngine] IndexedDB 初始化成功');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('[ProjectStorageEngine] IndexedDB 初始化失敗:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 取得所有專案清單（依最後更新時間降冪排序）
     */
    async getAllProjects() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const projects = request.result || [];
                // 依 updatedAt 排序 (新 -> 舊)
                projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
                resolve(projects);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 取得特定專案詳情
     */
    async getProject(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 儲存或更新專案
     */
    async saveProject(projectData) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const project = {
                ...projectData,
                updatedAt: Date.now()
            };

            const request = store.put(project);

            request.onsuccess = () => resolve(project);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 建立全新空白專案
     */
    async createBlankProject(options = {}) {
        const {
            name = '未命名專案',
            type = 'PDF', // 'IMAGE' or 'PDF'
            width = 1280,
            height = 720,
            ratio = '16:9'
        } = options;

        const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const pageId = 'page-1';

        const newProject = {
            id,
            name,
            type,
            dimension: { width, height, ratio },
            currentPageId: pageId,
            coverThumbnail: null,
            pageStates: {
                [pageId]: []
            },
            pageSizes: {
                [pageId]: { width, height }
            },
            pages: [
                { id: pageId, active: true, thumbnail: null }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: '1.2.0'
        };

        await this.saveProject(newProject);
        return newProject;
    }

    /**
     * 複製專案副本
     */
    async duplicateProject(sourceId) {
        const source = await this.getProject(sourceId);
        if (!source) throw new Error('來源專案不存在');

        const newId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const clonedProject = JSON.parse(JSON.stringify(source));

        clonedProject.id = newId;
        clonedProject.name = `${source.name} (副本)`;
        clonedProject.createdAt = Date.now();
        clonedProject.updatedAt = Date.now();

        await this.saveProject(clonedProject);
        return clonedProject;
    }

    /**
     * 重命名專案
     */
    async renameProject(id, newName) {
        const project = await this.getProject(id);
        if (!project) throw new Error('專案不存在');

        project.name = newName.trim() || '未命名專案';
        return await this.saveProject(project);
    }

    /**
     * 刪除專案
     */
    async deleteProject(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 匯出專案為 .editorproj 檔案
     */
    async exportProjectFile(id) {
        const project = await this.getProject(id);
        if (!project) throw new Error('專案不存在');

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `${project.name || 'project'}.editorproj`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    /**
     * 匯入 .editorproj 或 .json 專案檔案 (容錯相容完整專案與簡易 JSON 快照)
     */
    async importProjectFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const rawText = e.target.result;
                    let project;
                    try {
                        project = JSON.parse(rawText);
                    } catch (jsonErr) {
                        throw new Error('檔案非合法 JSON 格式');
                    }

                    if (!project || typeof project !== 'object') {
                        throw new Error('無效的專案檔案格式');
                    }

                    // 容錯提取 pageStates (相容完整專案結構、舊版 project.json、或 Fabric 物件陣列)
                    let pageStates = project.pageStates;
                    if (!pageStates) {
                        if (project.objects && Array.isArray(project.objects)) {
                            pageStates = { 'page-1': project.objects };
                        } else if (Array.isArray(project)) {
                            pageStates = { 'page-1': project };
                        }
                    }

                    if (!pageStates || typeof pageStates !== 'object' || Object.keys(pageStates).length === 0) {
                        throw new Error('未在檔案中找到有效的畫布頁面資料 (缺少 pageStates)');
                    }

                    const pageIds = Object.keys(pageStates);
                    const cleanName = file.name.replace(/\.(editorproj|json)$/i, '');

                    // 補齊缺失欄位
                    const newProject = {
                        id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                        name: project.name ? `${project.name} (匯入)` : `${cleanName} (匯入)`,
                        type: project.type || (pageIds.length > 1 ? 'PDF' : 'IMAGE'),
                        dimension: project.dimension || {
                            width: (project.pageSizes && project.pageSizes[pageIds[0]] && project.pageSizes[pageIds[0]].width) || 1280,
                            height: (project.pageSizes && project.pageSizes[pageIds[0]] && project.pageSizes[pageIds[0]].height) || 720,
                            ratio: '16:9'
                        },
                        currentPageId: project.currentPageId || pageIds[0],
                        coverThumbnail: project.coverThumbnail || null,
                        pageStates: pageStates,
                        pageSizes: project.pageSizes || {},
                        pages: project.pages || pageIds.map((pid, idx) => ({ id: pid, active: idx === 0, thumbnail: null })),
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        version: '1.2.1'
                    };

                    await this.saveProject(newProject);
                    resolve(newProject);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('讀取檔案失敗'));
            reader.readAsText(file);
        });
    }
}
