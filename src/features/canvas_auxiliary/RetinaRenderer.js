/**
 * RetinaRenderer.js
 * 高解析背景預渲染引擎 (Retina 2x High-Resolution Pre-renderer)
 * 負責在 PDF / PPTX 匯入與儀表板載入時，根據設定動態渲染 Retina 2.0x 超高解析畫布底板與 0.5x 輕量化縮圖
 */
export default class RetinaRenderer {
    /**
     * 檢查當前系統是否啟用 Retina 2x 高解析渲染
     * @returns {boolean}
     */
    static isRetinaEnabled() {
        return localStorage.getItem('editor_retina_render') !== 'false';
    }

    /**
     * 取得當前設定的渲染縮放比 (Retina: 2.0x, 標準: 1.0x)
     * @returns {number}
     */
    static getRenderScale() {
        return this.isRetinaEnabled() ? 2.0 : 1.0;
    }

    /**
     * 將 PDFPageProxy 渲染為高解析背景影像 DataURL
     * @param {PDFPageProxy} pdfPage 
     * @param {number|null} customScale 自訂縮放比例 (若未提供則自動讀取系統設定)
     * @returns {Promise<{ dataUrl: string, width: number, height: number, scale: number }>}
     */
    static async renderPageBackground(pdfPage, customScale = null) {
        const scale = customScale !== null ? customScale : this.getRenderScale();
        const viewport = pdfPage.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const dataUrl = canvas.toDataURL('image/png');

        return {
            dataUrl,
            width: viewport.width,
            height: viewport.height,
            scale
        };
    }

    /**
     * 將 PDFPageProxy 渲染為輕量級縮圖 (預設 0.5x 縮放，JPEG 壓縮)
     * @param {PDFPageProxy} pdfPage 
     * @param {number} scale 縮圖縮放比 (預設 0.5)
     * @param {number} quality JPEG 品質 (預設 0.8)
     * @returns {Promise<string>} 縮圖 DataURL
     */
    static async renderPageThumbnail(pdfPage, scale = 0.5, quality = 0.8) {
        const thumbViewport = pdfPage.getViewport({ scale });
        const thumbCanvas = document.createElement('canvas');
        const thumbContext = thumbCanvas.getContext('2d');
        thumbCanvas.width = thumbViewport.width;
        thumbCanvas.height = thumbViewport.height;

        await pdfPage.render({
            canvasContext: thumbContext,
            viewport: thumbViewport
        }).promise;

        return thumbCanvas.toDataURL('image/jpeg', quality);
    }
}
