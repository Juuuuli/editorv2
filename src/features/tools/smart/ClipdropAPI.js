export default class ClipdropAPI {
    static getApiKey() {
        // 使用 Vite 的環境變數
        const key = import.meta.env.VITE_CLIPDROP_API_KEY;
        if (!key) {
            throw new Error('未設定 Clipdrop API Key (VITE_CLIPDROP_API_KEY)');
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

        const response = await fetch('/api/clipdrop/remove-background/v1', {
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

        const response = await fetch('/api/clipdrop/cleanup/v1', {
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
