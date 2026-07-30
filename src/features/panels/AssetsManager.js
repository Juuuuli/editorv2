export default class AssetsManager {
    constructor() {
        this.dbName = 'EditorAssetsDB';
        this.dbVersion = 1;
        this.storeName = 'assets';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                if (!this.db.objectStoreNames.contains(this.storeName)) {
                    this.db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                console.error('IndexedDB 載入失敗', event);
                reject(event);
            };
        });
    }

    async saveAsset(dataUrl, type = 'image') {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            const asset = {
                id: `asset-${Date.now()}`,
                type: type,
                dataUrl: dataUrl,
                createdAt: new Date().getTime()
            };

            const request = store.add(asset);
            
            request.onsuccess = () => resolve(asset);
            request.onerror = (e) => reject(e);
        });
    }

    async getAllAssets() {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                // 依照建立時間降序 (新的在前面)
                const assets = request.result || [];
                assets.sort((a, b) => b.createdAt - a.createdAt);
                resolve(assets);
            };
            request.onerror = (e) => reject(e);
        });
    }
    
    async deleteAsset(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }
}
