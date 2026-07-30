export default class MockAPI {
    /**
     * 模擬 OCR (光學字元辨識)
     */
    static async ocr(imageDataUrl) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // 回傳隨機的假文字
                const words = ['設計', '排版', '開發', '創新', '畫布', '智能', '系統', '體驗', '模組', '測試'];
                const randomWord = () => words[Math.floor(Math.random() * words.length)];
                resolve({
                    text: `${randomWord()}${randomWord()} ${randomWord()}`,
                    confidence: 0.95
                });
            }, 1500); // 模擬 1.5 秒的網路延遲
        });
    }

    /**
     * 模擬一鍵去背 (Remove Background)
     * 因為是 Mock，我們回傳一張固定的帶透明通道 PNG
     */
    static async removeBackground(imageDataUrl) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // 這裡使用一個簡單的 DataURL (透明背景的笑臉圖) 作為示意
                const mockTransparentImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVGhD7c9BCsIwEEVRE+9/X+PChStxJwpeQ3Qk/QczlYF5sF0w8E0/I891XR+v1+v9/X6/eZ7neTwez3EcX5qm6Xmep3cEQRAEQRAEQRAEQRAEQRAEQRD+3b5t2/O6ruvLsixPz/M8/b9zHMen930/P3VdXxAEQRAEQRAEQRAEQRAEQRAEQfi3eJ7nq+d5nna73fNxHJ/Wdf3yff/h5xkEQfiB9x9XwQ6/nI2u6AAAAABJRU5ErkJggg==';
                resolve({
                    resultUrl: mockTransparentImage
                });
            }, 2000);
        });
    }

    /**
     * 模擬塗抹修補 (Inpainting)
     */
    static async inpaint(imageDataUrl, maskDataUrl) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // 模擬修補完成，我們回傳一張隨機顏色的實心方塊代表修補後的圖
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 80%)`;
                ctx.fillRect(0, 0, 100, 100);
                resolve({
                    resultUrl: canvas.toDataURL('image/png')
                });
            }, 2500);
        });
    }
}
