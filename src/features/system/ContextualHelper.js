export default class ContextualHelper {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.helperEl = document.getElementById('context-helper');
        this.helperTextEl = document.getElementById('context-helper-text');
        this.helperTimeout = null;
        
        this.init();
    }

    init() {
        this.initTooltips();
        
        // 監聽狀態改變事件
        this.eventBus.on('APP:STATUS_UPDATE', (data) => {
            this.showHelper(data.text);
        });
        
        // 監聽工具改變事件，自動提供對應的說明
        this.eventBus.on('UI:TOOL_CHANGED', (data) => {
            this.handleToolChange(data.tool);
        });
    }

    handleToolChange(mode) {
        let msg = '';
        switch(mode) {
            case 'selection': msg = '選取模式：點擊或拖曳以選取物件'; break;
            case 'brush': msg = '手繪模式：按住滑鼠在畫布上自由繪圖'; break;
            case 'text': msg = '新增文字：在畫布上點擊以輸入文字'; break;
            case 'table': msg = '表格建立：在畫布上點擊並拖曳以繪製表格'; break;
            case 'qrcode': msg = 'QR 條碼：在畫布上點擊以新增條碼'; break;
            case 'ext-img': msg = '新增外部圖片：請選擇要匯入的圖片'; break;
            case 'area-rmbg': msg = '選框去背：在畫布上框選要去背的區域'; break;
            case 'inpaint': msg = '智慧修補：請先選取圖片，再塗抹要修補的區域'; break;
            case 'brush-inpaint': msg = '塗抹修補：在畫布上塗抹要修除的區域'; break;
            case 'ocr': msg = '智慧辨識 (OCR)：框選畫布上的文字區域進行辨識'; break;
            case 'solid-fill': msg = '純色覆蓋：吸取顏色並在畫布上塗抹覆蓋'; break;
            default: msg = '就緒';
        }
        if (msg) this.showHelper(msg);
    }

    showHelper(text, duration = 0) {
        // 使用者要求移除此功能
        return;
    }
    
    hideHelper() {
        // 使用者要求移除此功能
        return;
    }

    // 動態綁定 tooltip 到所有帶有 title 的按鈕或特定按鈕
    initTooltips() {
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'sketch-tooltip';
        document.body.appendChild(tooltipEl);

        // 自訂提示內容對照表
        const tooltipsMap = {
            'btn-tool-select': '選取工具\n點擊或框選畫布上的物件',
            'btn-tool-brush': '手繪筆刷\n自由在畫布上塗鴉',
            'btn-tool-brush-inpaint': '塗抹修補 (畫筆)\n手動塗抹並使用AI消除瑕疵',
            'btn-tool-area-rmbg': '選框去背\n框選圖片中的主體，一鍵去背',
            'btn-tool-inpaint': '智慧修補\nAI自動填補畫面空白或移除物件',
            'btn-tool-ocr': '智慧辨識 (OCR)\n框選圖片，轉為可編輯文字',
            'btn-tool-solid-fill': '純色覆蓋\n吸取周圍顏色並覆蓋塗抹',
            'btn-tool-text': '新增文字\n點擊畫布以輸入純文字',
            'btn-tool-table': '建立表格\n在畫布上拖曳出表格區域',
            'btn-tool-qrcode': 'QR 條碼\n建立專屬的可掃描條碼',
            'btn-tool-ext-img': '外部圖片\n匯入您電腦中的圖片'
        };

        const buttons = document.querySelectorAll('button');
        
        buttons.forEach(btn => {
            let tooltipText = tooltipsMap[btn.id] || btn.getAttribute('title');
            if (!tooltipText) return;

            // 移除原生 title 避免干擾
            if (btn.getAttribute('title')) {
                btn.setAttribute('data-original-title', btn.getAttribute('title'));
                btn.removeAttribute('title');
            }

            btn.addEventListener('mouseenter', (e) => {
                // 將換行符號 \n 轉換為 <br>
                if (tooltipText.includes('\n')) {
                    tooltipEl.innerHTML = tooltipText.replace(/\n/g, '<br><span class="text-slate-400 font-normal text-xs mt-1 block">') + '</span>';
                } else {
                    tooltipEl.innerHTML = tooltipText;
                }
                
                const rect = btn.getBoundingClientRect();
                
                // 計算位置 (由於工具列在左側，靠左對齊最安全，避免左側超出螢幕)
                let top = rect.bottom + 8;
                let left = Math.max(8, rect.left); // 保證至少離邊緣 8px
                
                tooltipEl.style.top = top + 'px';
                tooltipEl.style.left = left + 'px';
                tooltipEl.style.transform = ''; // 移除 inline transform 讓 CSS 處理彈出動畫
                
                tooltipEl.classList.add('show');

                // 檢查是否超出底部邊界或右側邊界
                requestAnimationFrame(() => {
                    const ttRect = tooltipEl.getBoundingClientRect();
                    if (ttRect.bottom > window.innerHeight - 8) {
                        tooltipEl.style.top = (rect.top - ttRect.height - 8) + 'px';
                    }
                    if (ttRect.right > window.innerWidth - 8 && rect.left > window.innerWidth / 2) {
                        tooltipEl.style.left = Math.max(8, window.innerWidth - ttRect.width - 8) + 'px';
                    }
                });
            });

            btn.addEventListener('mouseleave', () => {
                tooltipEl.classList.remove('show');
            });
            
            // 點擊後隱藏
            btn.addEventListener('click', () => {
                tooltipEl.classList.remove('show');
            });
        });
    }
}
