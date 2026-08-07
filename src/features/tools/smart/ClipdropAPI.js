export default class ClipdropAPI {
    static getApiKey() {
        let key = '';
        try {
            const vaultConfig = JSON.parse(localStorage.getItem('EDITOR_V2_VAULT_CONFIG') || '{}');
            const legacyVault = JSON.parse(localStorage.getItem('editor_api_vault') || '{}');
            key = vaultConfig.imageProcessing?.apiKey || legacyVault.clipdropKey || localStorage.getItem('clipdrop_api_key') || (import.meta.env && import.meta.env.VITE_CLIPDROP_API_KEY) || '';
        } catch (e) {
            key = (import.meta.env && import.meta.env.VITE_CLIPDROP_API_KEY) || '';
        }

        if (!key) {
            throw new Error('未設定 Clipdrop API Key（請至右上角系統金鑰保險箱設定或配置環境變數）');
        }
        return key;
    }

    /**
     * 一鍵去背 (Remove Background)
     * @param {Blob} imageBlob 圖片 Blob
     * @returns {Promise<string>} 回傳結果的 Object URL
     */
    static async removeBackground(imageBlob) {
        const formData = new FormData();
        formData.append('image_file', imageBlob);

        const baseUrl = import.meta.env.DEV ? '/api/clipdrop' : 'https://clipdrop-api.co';
        
        const response = await fetch(`${baseUrl}/remove-background/v1`, {
            method: 'POST',
            headers: {
                'x-api-key': this.getApiKey()
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Clipdrop API Error:', errorText);
            throw new Error(`去背失敗: ${response.status} ${response.statusText}`);
        }

        const resultBlob = await response.blob();
        return URL.createObjectURL(resultBlob);
    }

    /**
     * 塗抹修補 (Cleanup / Inpainting)
     * @param {Blob} imageBlob 原圖 Blob
     * @param {Blob} maskBlob 遮罩 Blob (PNG, 尺寸需相同, 白色/255 代表欲移除修補的區域)
     * @returns {Promise<string>} 回傳結果的 Object URL
     */
    static async inpaint(imageBlob, maskBlob) {
        const formData = new FormData();
        formData.append('image_file', imageBlob);
        formData.append('mask_file', maskBlob);

        const baseUrl = import.meta.env.DEV ? '/api/clipdrop' : 'https://clipdrop-api.co';

        const response = await fetch(`${baseUrl}/cleanup/v1`, {
            method: 'POST',
            headers: {
                'x-api-key': this.getApiKey()
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Clipdrop API Error:', errorText);
            throw new Error(`修補失敗: ${response.status} ${response.statusText}`);
        }

        const resultBlob = await response.blob();
        return URL.createObjectURL(resultBlob);
    }
}
