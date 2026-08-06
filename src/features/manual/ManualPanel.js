import './manual.css';

export default class ManualPanel {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.isOpen = false;
        this.currentPage = 0;
        this.totalPages = 8; // Now 8 chapters total (added API details)
        this.init();
    }

    init() {
        this.modalElement = document.createElement('div');
        this.modalElement.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 opacity-0 pointer-events-none';
        
        // Generate notebook rings (12 rings)
        let ringsHTML = '';
        for(let i=0; i<12; i++) {
            ringsHTML += '<div class="notebook-ring"></div>';
        }

        this.modalElement.innerHTML = `
            <div class="notebook-modal">
                <button id="btn-close-manual" class="absolute top-6 right-6 text-white hover:text-rose-400 transition text-4xl"><i class="fas fa-times-circle"></i></button>
                
                <div class="notebook-book page-shadow">
                    <!-- Tabs (Table of Contents) -->
                    <div class="notebook-tabs" id="notebook-tabs">
                        <!-- Tabs will be rendered here -->
                    </div>

                    <!-- Left Page (Static base) -->
                    <div class="notebook-page left relative">
                        <div class="notebook-page-content" id="notebook-left-content">
                            <!-- Left content goes here -->
                        </div>
                        <div id="notebook-left-scroll-hint" class="absolute bottom-4 left-0 right-0 text-center pointer-events-none transition-opacity duration-300 opacity-0">
                            <span class="bg-indigo-100/90 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm inline-flex items-center gap-2 animate-bounce border border-indigo-200">
                                <i class="fas fa-mouse"></i> 可向下捲動
                            </span>
                        </div>
                    </div>

                    <!-- Binder Rings -->
                    <div class="notebook-binder">
                        ${ringsHTML}
                    </div>

                    <!-- Right Page (Static base) -->
                    <div class="notebook-page right relative">
                        <div class="notebook-page-content" id="notebook-right-content">
                            <!-- Right content goes here -->
                        </div>
                        <div id="notebook-right-scroll-hint" class="absolute bottom-4 left-0 right-0 text-center pointer-events-none transition-opacity duration-300 opacity-0">
                            <span class="bg-indigo-100/90 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm inline-flex items-center gap-2 animate-bounce border border-indigo-200">
                                <i class="fas fa-mouse"></i> 可向下捲動
                            </span>
                        </div>
                    </div>

                    <!-- Flip Animation Layer -->
                    <div class="notebook-page right origin-left transition-transform duration-500 ease-in-out z-20 pointer-events-none hidden" id="notebook-flip-layer">
                        <div class="notebook-page-content bg-[#fdfbf7]" id="notebook-flip-content"></div>
                    </div>
                </div>

                <!-- Navigation Controls -->
                <div class="absolute bottom-6 flex gap-6 z-50">
                    <button id="btn-manual-prev" class="sketch-btn px-6 py-2 bg-white text-slate-700 font-bold shadow-lg hover:bg-slate-50"><i class="fas fa-arrow-left mr-2"></i> 上一頁</button>
                    <span id="manual-page-indicator" class="bg-white/80 px-4 py-2 rounded-lg font-bold text-slate-700 shadow-md">1 / 8</span>
                    <button id="btn-manual-next" class="sketch-btn px-6 py-2 bg-white text-slate-700 font-bold shadow-lg hover:bg-slate-50">下一頁 <i class="fas fa-arrow-right ml-2"></i></button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalElement);

        this.tabsContainer = document.getElementById('notebook-tabs');
        this.leftContent = document.getElementById('notebook-left-content');
        this.rightContent = document.getElementById('notebook-right-content');
        this.flipLayer = document.getElementById('notebook-flip-layer');
        this.flipContent = document.getElementById('notebook-flip-content');
        
        this.leftHint = document.getElementById('notebook-left-scroll-hint');
        this.rightHint = document.getElementById('notebook-right-scroll-hint');
        
        this.btnPrev = document.getElementById('btn-manual-prev');
        this.btnNext = document.getElementById('btn-manual-next');
        this.pageIndicator = document.getElementById('manual-page-indicator');

        document.getElementById('btn-close-manual').addEventListener('click', () => this.close());
        this.btnPrev.addEventListener('click', () => this.prevPage());
        this.btnNext.addEventListener('click', () => this.nextPage());
        
        // Add scroll event listeners to update hints dynamically
        this.leftContent.addEventListener('scroll', () => this.updateScrollHints());
        this.rightContent.addEventListener('scroll', () => this.updateScrollHints());

        this.pagesData = this.getPagesData();
        this.renderTabs();
        this.renderCurrentPage(false);
    }

    getPagesData() {
        return [
            // Page 0: Cover / Welcome
            {
                tabName: "封面",
                left: `
                    <div class="h-full flex flex-col justify-center items-center text-center px-4">
                        <h2 class="text-3xl font-bold text-slate-700 mb-6 border-b-2 border-slate-300 pb-2">章節目錄</h2>
                        <ul class="text-left space-y-4 text-slate-600 text-lg w-full px-8">
                            <li>1. 系統區塊說明</li>
                            <li>2. 工作區說明</li>
                            <li>3. 基礎工具介紹</li>
                            <li>4. 智慧去背與修補</li>
                            <li>5. 加入新物件</li>
                            <li>6. 其它操作與設定</li>
                            <li>7. 後台與 API 架構說明</li>
                        </ul>
                    </div>
                `,
                right: `
                    <div class="h-full flex flex-col justify-center items-center text-center">
                        <i class="fas fa-book-open text-6xl text-indigo-300 mb-6"></i>
                        <h1 class="text-4xl font-bold text-indigo-800 mb-4 sketch-text">多媒體畫布編輯器 V2</h1>
                        <h2 class="text-xl text-slate-600 mb-8 font-bold border-b-2 border-indigo-200 pb-4 inline-block">系統操作說明書</h2>
                        <p class="text-slate-500 leading-relaxed max-w-sm">歡迎！您隨時可以點擊右側的「書籤標籤」或是下方的按鈕來切換章節。</p>
                    </div>
                `
            },
            // Page 1: System Layout
            {
                tabName: "系統分區",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">1. 系統區塊說明</h3>
                    <p class="text-slate-600 leading-relaxed text-lg">系統介面主要分為四大區塊，各自負責不同的功能：</p>
                    <ul class="list-disc pl-6 text-slate-600 space-y-4 mt-6 text-lg">
                        <li><strong>上方工具列：</strong> 檔案匯出、復原/重做等全局功能。</li>
                        <li><strong>左側面板：</strong> 提供所有繪圖工具與屬性設定（顏色、字體、粗細等）。</li>
                        <li><strong>中間畫布：</strong> 您的主要設計區域。</li>
                        <li><strong>右側縮圖：</strong> 管理您的所有頁面與圖層狀態。</li>
                    </ul>
                `,
                right: `
                    <div class="h-full flex flex-col justify-center">
                        <div class="sketch p-2 bg-slate-50 w-full h-auto">
                            <svg viewBox="0 0 800 500" class="w-full h-auto drop-shadow-sm rounded">
                                <!-- Header -->
                                <rect x="10" y="10" width="780" height="50" fill="#eff6ff" stroke="#3b82f6" stroke-width="2" rx="5"/>
                                <text x="400" y="40" font-family="sans-serif" font-size="18" fill="#1e3a8a" text-anchor="middle" font-weight="bold">上方：系統工具列 (復原/重做/匯出)</text>
                                
                                <!-- Left Sidebar -->
                                <rect x="10" y="70" width="200" height="420" fill="#fef2f2" stroke="#ef4444" stroke-width="2" rx="5"/>
                                <text x="110" y="280" font-family="sans-serif" font-size="18" fill="#7f1d1d" text-anchor="middle" font-weight="bold">左側：工具/屬性</text>
                                
                                <!-- Right Sidebar -->
                                <rect x="590" y="70" width="200" height="420" fill="#f0fdf4" stroke="#22c55e" stroke-width="2" rx="5"/>
                                <text x="690" y="280" font-family="sans-serif" font-size="18" fill="#14532d" text-anchor="middle" font-weight="bold">右側：分頁縮圖</text>
                                
                                <!-- Canvas -->
                                <rect x="220" y="70" width="360" height="420" fill="#f8fafc" stroke="#64748b" stroke-width="2" stroke-dasharray="8,4" rx="5"/>
                                <text x="400" y="280" font-family="sans-serif" font-size="24" fill="#334155" text-anchor="middle" font-weight="bold">中間：繪圖畫布</text>
                            </svg>
                        </div>
                    </div>
                `
            },
            // Page 2: Workspace
            {
                tabName: "工作區",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">2. 工作區說明 (圖片模式)</h3>
                    <p class="text-slate-600 mb-4 text-lg">在畫面右上角可以切換工作區模式。此為預設的圖片工作區：</p>
                    <ul class="list-disc pl-5 text-slate-600 space-y-2 mb-6">
                        <li><strong>特色：</strong> 適合單張海報、社群圖文的設計。無限延伸畫布，自由發揮創意。</li>
                    </ul>
                    <div class="flex-1 flex flex-col justify-center mt-4">
                        <h4 class="text-xl font-bold text-slate-700 mb-4"><i class="fas fa-image text-indigo-400 mr-2"></i> 圖片模式示範：</h4>
                        <div class="sketch p-2 bg-slate-50 w-full mx-auto">
                            <img src="./manual/image-workspace-demo.png" alt="圖片工作區" class="w-full rounded block">
                        </div>
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">工作區說明 (PDF 模式)</h3>
                    <p class="text-slate-600 mb-4 text-lg">切換至簡報 / PDF工作區，您將能管理多頁面：</p>
                    <ul class="list-disc pl-5 text-slate-600 space-y-2 mb-6">
                        <li><strong>特色：</strong> 專為多頁文件設計。支援 PDF 匯入、分頁預覽，並鎖定 A4 或簡報比例。</li>
                    </ul>
                    <div class="flex-1 flex flex-col justify-center mt-4">
                        <h4 class="text-xl font-bold text-slate-700 mb-4"><i class="fas fa-file-pdf text-indigo-400 mr-2"></i> PDF 模式示範：</h4>
                        <div class="sketch p-2 bg-slate-50 w-full mx-auto">
                            <img src="./manual/pdf-workspace-demo.png" alt="PDF 工作區" class="w-full rounded block">
                        </div>
                    </div>
                `
            },
            // Page 3: Basic Tools
            {
                tabName: "基礎工具",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">3. 基礎工具介紹 (1/2)</h3>
                    <div class="space-y-8">
                        <div class="flex gap-4 items-start pb-4 border-b border-slate-200 last:border-0">
                            <div class="w-12 h-12 shrink-0 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xl sketch-panel p-0">
                                <i class="fas fa-mouse-pointer"></i>
                            </div>
                            <div class="flex-1">
                                <h5 class="font-bold text-slate-800 mb-3">選取工具</h5>
                                <div class="space-y-6">
                                    <div>
                                        <p class="text-sm text-slate-600 mb-2"><strong>操作 1：</strong>點擊拖曳與變形物件</p>
                                        <div class="sketch p-1 bg-slate-50">
                                            <img src="./manual/select-drag-demo.gif" class="w-full rounded block">
                                        </div>
                                    </div>
                                    <div>
                                        <p class="text-sm text-slate-600 mb-2"><strong>操作 2：</strong>拖曳畫出紅色選取框</p>
                                        <div class="sketch p-1 bg-slate-50">
                                            <img src="./manual/select-box-demo.gif" class="w-full rounded block">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ${this.generateToolBlock('fas fa-hand-paper', '平移畫布', '按住滑鼠左鍵拖曳即可平移。', './manual/pan-demo.gif')}
                        ${this.generateToolBlock('fas fa-shapes', '加入形狀', '在畫布上產生矩形，並可透過左側「屬性」面板調整顏色與邊框樣式。', './manual/shape-demo.gif')}
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">基礎工具介紹 (2/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-paint-brush', '塗鴉筆刷', '自由在畫布上繪製塗鴉。', './manual/brush-demo.gif')}
                        ${this.generateToolBlock('fas fa-search-plus', '放大畫布', '點擊畫布以放大視野。', './manual/zoom-in-demo.gif')}
                        ${this.generateToolBlock('fas fa-search-minus', '縮小畫布', '點擊畫布以縮小視野。', './manual/zoom-out-demo.gif')}
                    </div>
                `
            },
            // Page 4: Smart Tools
            {
                tabName: "智慧工具",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">4. 智慧去背與修補 (1/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-magic', '一鍵去背', '全自動辨識主要主體並移除背景。<br><span class="text-orange-500 font-bold">※ 等待模型處理需要一點時間</span>', './manual/auto-rmbg-demo.gif')}
                        ${this.generateToolBlock('fas fa-eraser', '塗抹修補', '塗抹想要修飾的瑕疵，AI 會自動填補。<br><span class="text-orange-500 font-bold">※ 等待模型處理需要一點時間</span>', './manual/brush-inpaint-demo.gif')}
                        ${this.generateToolBlock('fas fa-cut', '選框去背', '框選想要去背的範圍，僅針對該範圍內的主體去背。<br><span class="text-orange-500 font-bold">※ 等待模型處理需要一點時間</span>', './manual/area-rmbg-demo.gif')}
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">智慧去背與修補 (2/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-band-aid', '智慧修補', '框選不要的物件，讓它一秒消失。', './manual/inpaint-demo.gif')}
                        ${this.generateToolBlock('fas fa-font', '智慧辨識 (OCR)', '框選圖片文字，轉換為純文字。', './manual/ocr-demo.gif')}
                        ${this.generateToolBlock('fas fa-square', '純色覆蓋', '吸取顏色並覆蓋圖片上的資訊。', './manual/solid-fill-demo.gif')}
                    </div>
                `
            },
            // Page 5: Add Objects
            {
                tabName: "加入物件",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">5. 加入新物件 (1/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-text-width', '新增文字', '點擊新增文字方塊，支援多種中英文字體。', './manual/text-demo.gif')}
                        ${this.generateToolBlock('fas fa-table', '建立表格', '繪製可調整欄列寬度與背景色的表格。', './manual/table-demo.gif')}
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">加入新物件 (2/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-qrcode', 'QR 條碼', '輸入網址，一鍵產生向量 QR 條碼。', './manual/qrcode-demo.gif')}
                        ${this.generateToolBlock('fas fa-image', '外部圖片', '上傳電腦中的圖片 (JPG/PNG)。', './manual/image-demo.gif')}
                    </div>
                `
            },
            // Page 6: Misc Settings
            {
                tabName: "其它設定",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">6. 畫布比例說明</h3>
                    <p class="text-slate-600 mb-4">在畫面左上角，您可以隨時調整畫布的長寬比例：</p>
                    <div class="sketch p-2 bg-slate-50 w-full mx-auto mb-6">
                        <img src="./manual/ratio-switch-demo.gif" alt="比例切換" class="w-full rounded block">
                    </div>
                    <ul class="list-disc pl-5 text-slate-600 space-y-3">
                        <li><strong>16:9 (圖片)：</strong> 適合 YouTube 封面或寬螢幕簡報。</li>
                        <li><strong>4:3 (圖片)：</strong> 適合傳統螢幕或一般圖文排版。</li>
                        <li><strong>橫向 / 直式 (PDF)：</strong> 在 PDF 工作區專用，鎖定標準 A4 比例，可依需求切換紙張方向。</li>
                    </ul>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">7. 右下角工具說明</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-expand', '全螢幕模式', '隱藏所有干擾，專注於畫布編輯。', './manual/fullscreen-demo.mp4')}
                        ${this.generateToolBlock('fas fa-layer-group', '圖層快速預覽', '快速查看與調整物件的前後圖層順序。', './manual/layers-demo.gif')}
                        ${this.generateToolBlock('fas fa-comment-dots', '留言評論', '與團隊成員在畫布上進行協作討論。', './manual/comments-demo.gif')}
                    </div>
                `
            },
            // Page 7: API Architecture
            {
                tabName: "後台架構",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6"><i class="fas fa-server mr-2"></i> 7. 後台與 API 架構說明</h3>
                    <p class="text-slate-600 text-lg leading-relaxed mb-4">本系統的「智慧工具」採用模組化設計，目前透過串接公開 API 提供強大的 AI 運算能力。以下為目前串接的服務清單：</p>
                    
                    <div class="space-y-4 mt-6">
                        <div class="p-4 bg-orange-50 border-l-4 border-orange-400 rounded-r shadow-sm">
                            <h4 class="font-bold text-orange-800 text-lg mb-1">簡報解析 (PPT / PPTX)</h4>
                            <p class="text-slate-600 text-sm">目前串接系統：<span class="font-mono bg-white px-1 rounded text-orange-600">ConvertAPI</span></p>
                            <p class="text-slate-500 text-sm mt-1">用途：將企業常見的 PPT 簡報雲端轉換為標準 PDF，以利匯入畫布成為多頁面專案。</p>
                        </div>

                        <div class="p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r shadow-sm">
                            <h4 class="font-bold text-indigo-800 text-lg mb-1">智慧辨識 (OCR)</h4>
                            <p class="text-slate-600 text-sm">目前串接系統：<span class="font-mono bg-white px-1 rounded text-indigo-600">OpenAI Vision API (GPT-4o-mini)</span></p>
                            <p class="text-slate-500 text-sm mt-1">用途：框選畫布文字區域，辨識複雜版面、文字擷取與多國語言。</p>
                        </div>
                        
                        <div class="p-4 bg-teal-50 border-l-4 border-teal-400 rounded-r shadow-sm">
                            <h4 class="font-bold text-teal-800 text-lg mb-1">去背與塗抹修補</h4>
                            <p class="text-slate-600 text-sm">目前串接系統：<span class="font-mono bg-white px-1 rounded text-teal-600">Clipdrop API (Inpainting & Remove-BG)</span></p>
                            <p class="text-slate-500 text-sm mt-1">用途：透過生成式 AI 無縫去背與填補抹除物件後的背景。</p>
                        </div>
                    </div>
                `,
                right: `
                    <div>
                        <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6"><i class="fas fa-exchange-alt mr-2"></i> 擴充與技術替換方案</h3>
                        <p class="text-slate-600 text-lg leading-relaxed mb-6">本系統的底層介面已高度標準化，具備極高的擴充性。若未來考量到資安或隱私需求，現有的模組皆可無縫替換為以下方案：</p>
                        
                        <ul class="list-disc pl-6 text-slate-600 space-y-6 text-lg">
                            <li>
                                <strong>OCR 智慧辨識 (替代方案)</strong><br>
                                <span class="text-sm text-slate-500">可從 OpenAI 雲端服務替換為純前端邊緣運算的 <code class="text-indigo-500">Tesseract.js</code>，或內網自建的 <code class="text-indigo-500">Ollama (Vision)</code> 模型，實現完全斷網辨識。</span>
                            </li>
                            <li>
                                <strong>AI 塗抹修補 (替代方案)</strong><br>
                                <span class="text-sm text-slate-500">目前使用 Photoroom 雲端生成，未來可串接私有部署的 <code class="text-indigo-500">Stable Diffusion</code> 伺服器，或開源的 <code class="text-indigo-500">Lama Cleaner</code>，確保修改圖片不外流。</span>
                            </li>
                            <li>
                                <strong>PPT 簡報解析 (替代方案)</strong><br>
                                <span class="text-sm text-slate-500">除了依賴目前的 ConvertAPI 雲端轉檔外，系統設計相容於自架的 <code class="text-indigo-500">LibreOffice (Gotenberg)</code> 伺服器，可隨時切換為 100% 內網離線轉檔架構。</span>
                            </li>
                        </ul>
                    </div>
                `
            }
        ];
    }

    generateToolBlock(icon, title, desc, imgSrc) {
        const finalSrc = (imgSrc.startsWith('./manual/') || imgSrc.startsWith('src/') || imgSrc.startsWith('http')) 
            ? imgSrc 
            : `https://placehold.co/400x200/e2e8f0/64748b?text=${imgSrc}`;
            
        const isVideo = finalSrc.toLowerCase().endsWith('.mp4');
        const mediaHtml = isVideo 
            ? `<video src="${finalSrc}" class="w-full rounded block" autoplay loop muted playsinline></video>`
            : `<img src="${finalSrc}" class="w-full rounded block">`;
            
        return `
            <div class="flex gap-4 items-start pb-4 border-b border-slate-200 last:border-0">
                <div class="w-12 h-12 shrink-0 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xl sketch-panel p-0">
                    <i class="${icon}"></i>
                </div>
                <div class="flex-1">
                    <h5 class="font-bold text-slate-800 mb-1">${title}</h5>
                    <p class="text-sm text-slate-600 mb-3">${desc}</p>
                    <div class="sketch p-1 bg-slate-50">
                        ${mediaHtml}
                    </div>
                </div>
            </div>
        `;
    }

    renderTabs() {
        let tabsHTML = '';
        this.pagesData.forEach((page, index) => {
            const activeClass = index === this.currentPage ? 'active' : '';
            tabsHTML += `
                <div class="notebook-tab ${activeClass}" onclick="document.dispatchEvent(new CustomEvent('MANUAL:GOTO', {detail: ${index}}))">
                    ${page.tabName}
                </div>
            `;
        });
        this.tabsContainer.innerHTML = tabsHTML;
    }

    renderCurrentPage(animate = true) {
        const data = this.pagesData[this.currentPage];
        
        // Update tabs active state
        Array.from(this.tabsContainer.children).forEach((tab, index) => {
            tab.className = 'notebook-tab' + (index === this.currentPage ? ' active' : '');
        });

        // If animation is requested, do a fake flip
        if (animate) {
            this.flipContent.innerHTML = this.rightContent.innerHTML;
            this.flipLayer.classList.remove('hidden');
            this.flipLayer.style.transform = 'rotateY(0deg)';
            
            // Set new content
            this.leftContent.innerHTML = data.left;
            this.rightContent.innerHTML = data.right;
            
            // Trigger flip
            setTimeout(() => {
                this.flipLayer.style.transform = 'rotateY(-90deg)';
                this.flipLayer.style.opacity = '0';
                
                setTimeout(() => {
                    this.flipLayer.classList.add('hidden');
                    this.flipLayer.style.transform = 'rotateY(0deg)';
                    this.flipLayer.style.opacity = '1';
                }, 300); // match transition duration
            }, 10);
        } else {
            this.leftContent.innerHTML = data.left;
            this.rightContent.innerHTML = data.right;
        }

        // Update controls
        this.btnPrev.disabled = this.currentPage === 0;
        this.btnNext.disabled = this.currentPage === this.totalPages - 1;
        this.btnPrev.style.opacity = this.currentPage === 0 ? '0.5' : '1';
        this.btnNext.style.opacity = this.currentPage === this.totalPages - 1 ? '0.5' : '1';
        this.pageIndicator.innerText = `${this.currentPage + 1} / ${this.totalPages}`;
        
        // Scroll to top
        this.leftContent.scrollTop = 0;
        this.rightContent.scrollTop = 0;
        
        // Update scroll hints after DOM layout
        setTimeout(() => this.updateScrollHints(), 50);
    }

    updateScrollHints() {
        const checkScroll = (contentEl, hintEl) => {
            if (!contentEl || !hintEl) return;
            // If the content is taller than the container, and we haven't scrolled to the very bottom
            if (contentEl.scrollHeight > contentEl.clientHeight + 10 && contentEl.scrollTop + contentEl.clientHeight < contentEl.scrollHeight - 20) {
                hintEl.classList.remove('opacity-0');
            } else {
                hintEl.classList.add('opacity-0');
            }
        };

        checkScroll(this.leftContent, this.leftHint);
        checkScroll(this.rightContent, this.rightHint);
    }

    nextPage() {
        if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
            this.renderCurrentPage(true);
        }
    }

    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.renderCurrentPage(true);
        }
    }
    
    goToPage(index) {
        if (index >= 0 && index < this.totalPages && index !== this.currentPage) {
            this.currentPage = index;
            this.renderCurrentPage(true);
        }
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        
        if(!this.boundGoTo) {
            this.boundGoTo = (e) => this.goToPage(e.detail);
            document.addEventListener('MANUAL:GOTO', this.boundGoTo);
        }
        
        this.modalElement.classList.remove('opacity-0', 'pointer-events-none');
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.modalElement.classList.add('opacity-0', 'pointer-events-none');
    }
}
