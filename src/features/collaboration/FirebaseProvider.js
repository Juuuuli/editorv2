import { storage } from '../../config/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export default class FirebaseProvider {
    /**
     * 將檔案上傳至 Firebase Storage 並取得下載網址
     */
    static async uploadAsset(fileOrBlob, filename = null) {
        if (!storage) throw new Error("Firebase Storage is not initialized.");
        
        const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const name = filename || fileOrBlob.name || 'unnamed_asset';
        const safeName = name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `assets/${uuid}/${safeName}`;
        
        const assetRef = storageRef(storage, path);
        
        console.log(`[FirebaseProvider] 開始上傳資源至 Storage: ${path}`);
        const snapshot = await uploadBytes(assetRef, fileOrBlob);
        console.log(`[FirebaseProvider] 上傳成功，正在取得網址...`);
        
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log(`[FirebaseProvider] 取得資源網址: ${downloadURL}`);
        return downloadURL;
    }
}

