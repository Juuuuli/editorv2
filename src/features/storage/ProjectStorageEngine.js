/**
 * ProjectStorageEngine.js
 * 專案本機持久化儲存引擎 (IndexedDB)
 * 負責所有專案的建立、讀取、更新、刪除 (CRUD)、縮圖儲存與匯入匯出
 */

export default class ProjectStorageEngine {
    constructor(authManager = null) {
        this.authManager = authManager;
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
                let currentUserId = 'unknown';
                if (this.authManager && this.authManager.getCurrentUser()) {
                    currentUserId = this.authManager.getCurrentUser().id;
                }
                
                projects.forEach(p => {
                    if (!p.ownerId) p.ownerId = currentUserId; // 相容舊專案
                });
                
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

            request.onsuccess = () => {
                const project = request.result || null;
                if (project && !project.ownerId) {
                    let currentUserId = 'unknown';
                    if (this.authManager && this.authManager.getCurrentUser()) {
                        currentUserId = this.authManager.getCurrentUser().id;
                    }
                    project.ownerId = currentUserId;
                }
                resolve(project);
            };
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
     * 建立全新專案 (支援自訂比例與預設模板排版)
     */
    async createBlankProject(options = {}) {
        const {
            name = '未命名專案',
            type = 'PDF', // 'IMAGE' or 'PDF'
            width = 1280,
            height = 720,
            ratio = '16:9',
            template = null,
            initialObjects = null
        } = options;

        const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const pageId = 'page-1';

        // 根據模板生成預設排版物件 (若無指定 initialObjects)
        let pageObjects = initialObjects || [];
        if (!initialObjects && template) {
            pageObjects = this.generateTemplateObjects(template, width, height, name);
        }

        let ownerId = 'unknown';
        if (this.authManager && this.authManager.getCurrentUser()) {
            ownerId = this.authManager.getCurrentUser().id;
        }

        const newProject = {
            id,
            ownerId,
            name,
            type,
            dimension: { width, height, ratio },
            currentPageId: pageId,
            coverThumbnail: null,
            pageStates: {
                [pageId]: pageObjects
            },
            pageSizes: {
                [pageId]: { width, height }
            },
            pages: [
                { id: pageId, active: true, thumbnail: null }
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: '1.5.0'
        };

        await this.saveProject(newProject);
        return newProject;
    }

    /**
     * 根據模板類型生成高品質初始設計元素
     */
    generateTemplateObjects(template, width, height, projectName) {
        const objects = [];
        const fontTC = 'Noto Sans TC, Inter, sans-serif';

        if (template === 'pdf_16_9') {
            // 商業企劃提案 16:9
            objects.push({
                type: 'textbox',
                text: 'BUSINESS PROPOSAL',
                left: 100,
                top: 180,
                width: 600,
                fontSize: 16,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#4f46e5',
                layerName: '分類標籤'
            });
            objects.push({
                type: 'textbox',
                text: projectName !== '未命名專案' ? projectName : '2026 商業企劃提案',
                left: 100,
                top: 220,
                width: 850,
                fontSize: 48,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#1e293b',
                layerName: '簡報主標題'
            });
            objects.push({
                type: 'textbox',
                text: '雙擊以編輯此處內容 · 探索創新與未來業務策略方向',
                left: 100,
                top: 310,
                width: 800,
                fontSize: 20,
                fontFamily: fontTC,
                fill: '#64748b',
                layerName: '副標題說明'
            });
        } else if (template === 'pdf_4_3') {
            // 經典簡報 4:3
            objects.push({
                type: 'textbox',
                text: 'PRESENTATION SLIDE',
                left: 80,
                top: 220,
                width: 500,
                fontSize: 15,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#0284c7',
                layerName: '分類標籤'
            });
            objects.push({
                type: 'textbox',
                text: projectName !== '未命名專案' ? projectName : '教學與簡報主題',
                left: 80,
                top: 260,
                width: 700,
                fontSize: 42,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#1e293b',
                layerName: '簡報主標題'
            });
            objects.push({
                type: 'textbox',
                text: '1024 × 768 · 經典投影比例多頁簡報',
                left: 80,
                top: 340,
                width: 650,
                fontSize: 18,
                fontFamily: fontTC,
                fill: '#64748b',
                layerName: '副標題說明'
            });
        } else if (template === 'image_1_1') {
            // 社群貼文 1:1 (1080x1080)
            objects.push({
                type: 'textbox',
                text: '✨ SOCIAL MEDIA POST',
                left: 100,
                top: 380,
                width: 500,
                fontSize: 20,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#ec4899',
                layerName: '社群標籤'
            });
            objects.push({
                type: 'textbox',
                text: projectName !== '未命名專案' ? projectName : '社群主打焦點焦點',
                left: 100,
                top: 430,
                width: 880,
                fontSize: 56,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#0f172a',
                layerName: '主標題文字'
            });
            objects.push({
                type: 'textbox',
                text: '1080 × 1080 · 完美適配 Instagram / Facebook 方形圖文',
                left: 100,
                top: 540,
                width: 850,
                fontSize: 24,
                fontFamily: fontTC,
                fill: '#64748b',
                layerName: '副標題文字'
            });
        } else if (template === 'image_16_9') {
            // 社群封面 / 橫幅 16:9
            objects.push({
                type: 'textbox',
                text: 'COVER DESIGN',
                left: 100,
                top: 200,
                width: 400,
                fontSize: 16,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#0d9488',
                layerName: '封面標籤'
            });
            objects.push({
                type: 'textbox',
                text: projectName !== '未命名專案' ? projectName : '精彩主題精華封面',
                left: 100,
                top: 240,
                width: 850,
                fontSize: 50,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#0f172a',
                layerName: '主標題文字'
            });
            objects.push({
                type: 'textbox',
                text: '支援一鍵去背與智慧修補 · 高畫質 PNG 匯出',
                left: 100,
                top: 330,
                width: 750,
                fontSize: 22,
                fontFamily: fontTC,
                fill: '#64748b',
                layerName: '副標題文字'
            });
        } else if (template === 'image_4_5') {
            // 肖像海報 4:5 (1080x1350)
            objects.push({
                type: 'textbox',
                text: 'POSTER & ADS',
                left: 100,
                top: 480,
                width: 500,
                fontSize: 22,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#8b5cf6',
                layerName: '海報標籤'
            });
            objects.push({
                type: 'textbox',
                text: projectName !== '未命名專案' ? projectName : '活動宣傳肖像海報',
                left: 100,
                top: 530,
                width: 880,
                fontSize: 58,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#0f172a',
                layerName: '海報大標題'
            });
            objects.push({
                type: 'textbox',
                text: '1080 × 1350 · 肖像直式廣告海報規格',
                left: 100,
                top: 640,
                width: 800,
                fontSize: 24,
                fontFamily: fontTC,
                fill: '#64748b',
                layerName: '說明文字'
            });
        } else if (template === 'pdf_a4') {
            // A4 直式文件報告 (794x1123)
            objects.push({
                type: 'textbox',
                text: '企劃專案報告書',
                left: 70,
                top: 260,
                width: 650,
                fontSize: 38,
                fontWeight: 'bold',
                fontFamily: fontTC,
                fill: '#0f172a',
                layerName: '文件大標題'
            });
            objects.push({
                type: 'textbox',
                text: '標準 A4 直式規格 · 支援多頁排版與 PDF 高清匯出',
                left: 70,
                top: 330,
                width: 650,
                fontSize: 16,
                fontFamily: fontTC,
                fill: '#64748b',
                layerName: '文件副標'
            });
            objects.push({
                type: 'textbox',
                text: '建立日期：' + new Date().toLocaleDateString('zh-TW'),
                left: 70,
                top: 380,
                width: 400,
                fontSize: 13,
                fontFamily: fontTC,
                fill: '#94a3b8',
                layerName: '日期資訊'
            });
        }

        return objects;
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
        
        let currentUserId = 'unknown';
        if (this.authManager && this.authManager.getCurrentUser()) {
            currentUserId = this.authManager.getCurrentUser().id;
        }
        clonedProject.ownerId = currentUserId;
        
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
                    let currentUserId = 'unknown';
                    if (this.authManager && this.authManager.getCurrentUser()) {
                        currentUserId = this.authManager.getCurrentUser().id;
                    }

                    const newProject = {
                        id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                        ownerId: currentUserId,
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
