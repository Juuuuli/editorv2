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
                                <i class="fas fa-mouse"></i> ?��?下捲??                            </span>
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
                                <i class="fas fa-mouse"></i> ?��?下捲??                            </span>
                        </div>
                    </div>

                    <!-- Flip Animation Layer -->
                    <div class="notebook-page right origin-left transition-transform duration-500 ease-in-out z-20 pointer-events-none hidden" id="notebook-flip-layer">
                        <div class="notebook-page-content bg-[#fdfbf7]" id="notebook-flip-content"></div>
                    </div>
                </div>

                <!-- Navigation Controls -->
                <div class="absolute bottom-6 flex gap-6 z-50">
                    <button id="btn-manual-prev" class="sketch-btn px-6 py-2 bg-white text-slate-700 font-bold shadow-lg hover:bg-slate-50"><i class="fas fa-arrow-left mr-2"></i> 上�???/button>
                    <span id="manual-page-indicator" class="bg-white/80 px-4 py-2 rounded-lg font-bold text-slate-700 shadow-md">1 / 8</span>
                    <button id="btn-manual-next" class="sketch-btn px-6 py-2 bg-white text-slate-700 font-bold shadow-lg hover:bg-slate-50">下�???<i class="fas fa-arrow-right ml-2"></i></button>
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
                        <h2 class="text-3xl font-bold text-slate-700 mb-6 border-b-2 border-slate-300 pb-2">章�??��?</h2>
                        <ul class="text-left space-y-4 text-slate-600 text-lg w-full px-8">
                            <li>1. 系統?�塊說??/li>
                            <li>2. 工�??�說�?</li>
                            <li>3. ?��?工具介紹</li>
                            <li>4. ?�慧?��??�修�?/li>
                            <li>5. ?�入?�物�?/li>
                            <li>6. ?��??��??�設�?/li>
                            <li>8. 後台??API ?��?說�?</li>
                        </ul>
                    </div>
                `,
                right: `
                    <div class="h-full flex flex-col justify-center items-center text-center">
                        <i class="fas fa-book-open text-6xl text-indigo-300 mb-6"></i>
                        <h1 class="text-4xl font-bold text-indigo-800 mb-4 sketch-text">多�?體畫布編輯器 V2</h1>
                        <h2 class="text-xl text-slate-600 mb-8 font-bold border-b-2 border-indigo-200 pb-4 inline-block">系統?��?說�???/h2>
                        <p class="text-slate-500 leading-relaxed max-w-sm">歡�?！您?��??�以點�??�側?�「書籤�?籤」�??��??��??��?來�??��?節??/p>
                    </div>
                `
            },
            // Page 1: System Layout
            {
                tabName: "系統?��?",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">1. 系統?�塊說??/h3>
                    <p class="text-slate-600 leading-relaxed text-lg">系統介面主�??�為?�大?�塊�??�自負責不�??��??��?</p>
                    <ul class="list-disc pl-6 text-slate-600 space-y-4 mt-6 text-lg">
                        <li><strong>上方工具?��?</strong> 檔�??�出?�復???��?等全局?�能??/li>
                        <li><strong>左側?�板�?/strong> ?��??�?�繪?�工?��?屬性設定�?顏色?��?體、�?細�?）�?/li>
                        <li><strong>中�??��?�?/strong> ?��?主�?設�??�?��?/li>
                        <li><strong>?�側縮�?�?/strong> 管�??��??�?��??��??�層?�?��?/li>
                    </ul>
                `,
                right: `
                    <div class="h-full flex flex-col justify-center">
                        <div class="sketch p-2 bg-slate-50 w-full h-auto">
                            <svg viewBox="0 0 800 500" class="w-full h-auto drop-shadow-sm rounded">
                                <!-- Header -->
                                <rect x="10" y="10" width="780" height="50" fill="#eff6ff" stroke="#3b82f6" stroke-width="2" rx="5"/>
                                <text x="400" y="40" font-family="sans-serif" font-size="18" fill="#1e3a8a" text-anchor="middle" font-weight="bold">上方：系統工?��? (復�?/?��?/?�出)</text>
                                
                                <!-- Left Sidebar -->
                                <rect x="10" y="70" width="200" height="420" fill="#fef2f2" stroke="#ef4444" stroke-width="2" rx="5"/>
                                <text x="110" y="280" font-family="sans-serif" font-size="18" fill="#7f1d1d" text-anchor="middle" font-weight="bold">左側：工??屬�?/text>
                                
                                <!-- Right Sidebar -->
                                <rect x="590" y="70" width="200" height="420" fill="#f0fdf4" stroke="#22c55e" stroke-width="2" rx="5"/>
                                <text x="690" y="280" font-family="sans-serif" font-size="18" fill="#14532d" text-anchor="middle" font-weight="bold">?�側：�??�縮??/text>
                                
                                <!-- Canvas -->
                                <rect x="220" y="70" width="360" height="420" fill="#f8fafc" stroke="#64748b" stroke-width="2" stroke-dasharray="8,4" rx="5"/>
                                <text x="400" y="280" font-family="sans-serif" font-size="24" fill="#334155" text-anchor="middle" font-weight="bold">中�?：繪?�畫�?/text>
                            </svg>
                        </div>
                    </div>
                `
            },
            // Page 2: Workspace
            {
                tabName: "工�??�",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">2. 工�??�說�? (?��?模�?)</h3>
                    <p class="text-slate-600 mb-4 text-lg">?�畫?�右上�??�以?��?工�??�模�??�此?��?設�??��?工�??��?/p>
                    <ul class="list-disc pl-5 text-slate-600 space-y-2 mb-6">
                        <li><strong>?�色�?/strong> ?��??�張海報?�社群�??��?設�??�無?�延伸畫布�??�由?�揮?��???/li>
                    </ul>
                    <div class="flex-1 flex flex-col justify-center mt-4">
                        <h4 class="text-xl font-bold text-slate-700 mb-4"><i class="fas fa-image text-indigo-400 mr-2"></i> ?��?模�?示�?�?/h4>
                        <div class="sketch p-2 bg-slate-50 w-full mx-auto">
                            <img src="./manual/image-workspace-demo.png" alt="?��?工�??�" class="w-full rounded block">
                        </div>
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">工�??�說�? (PDF 模�?)</h3>
                    <p class="text-slate-600 mb-4 text-lg">?��??�簡??/ PDF工�??�，您將能管�?多�??��?</p>
                    <ul class="list-disc pl-5 text-slate-600 space-y-2 mb-6">
                        <li><strong>?�色�?/strong> 專為多�??�件設�??�支??PDF ?�入?��??��?覽�?並�?�?A4 ?�簡?��?例�?/li>
                    </ul>
                    <div class="flex-1 flex flex-col justify-center mt-4">
                        <h4 class="text-xl font-bold text-slate-700 mb-4"><i class="fas fa-file-pdf text-indigo-400 mr-2"></i> PDF 模�?示�?�?/h4>
                        <div class="sketch p-2 bg-slate-50 w-full mx-auto">
                            <img src="./manual/pdf-workspace-demo.png" alt="PDF 工�??�" class="w-full rounded block">
                        </div>
                    </div>
                `
            },
            // Page 3: Basic Tools
            {
                tabName: "?��?工具",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">3. ?��?工具介紹 (1/2)</h3>
                    <div class="space-y-8">
                        <div class="flex gap-4 items-start pb-4 border-b border-slate-200 last:border-0">
                            <div class="w-12 h-12 shrink-0 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center text-xl sketch-panel p-0">
                                <i class="fas fa-mouse-pointer"></i>
                            </div>
                            <div class="flex-1">
                                <h5 class="font-bold text-slate-800 mb-3">?��?工具</h5>
                                <div class="space-y-6">
                                    <div>
                                        <p class="text-sm text-slate-600 mb-2"><strong>?��? 1�?/strong>點�??�曳?��?形物�?/p>
                                        <div class="sketch p-1 bg-slate-50">
                                            <img src="./manual/select-drag-demo.gif" class="w-full rounded block">
                                        </div>
                                    </div>
                                    <div>
                                        <p class="text-sm text-slate-600 mb-2"><strong>?��? 2�?/strong>?�曳?�出紅色?��?�?/p>
                                        <div class="sketch p-1 bg-slate-50">
                                            <img src="./manual/select-box-demo.gif" class="w-full rounded block">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        ${this.generateToolBlock('fas fa-hand-paper', '平移?��?', '?��?滑�?左鍵?�曳?�可平移??, './manual/pan-demo.gif')}
                        ${this.generateToolBlock('fas fa-shapes', '?�入形�?', '?�畫布�??��??�形，並?�透�?左側?�屬?�」面?�調?��??��??��?�????, './manual/shape-demo.gif')}
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">?��?工具介紹 (2/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-paint-brush', '塗�?筆刷', '?�由?�畫布�?繪製塗�???, './manual/brush-demo.gif')}
                        ${this.generateToolBlock('fas fa-search-plus', '?�大?��?', '點�??��?以放大�??��?, './manual/zoom-in-demo.gif')}
                        ${this.generateToolBlock('fas fa-search-minus', '縮�??��?', '點�??��?以縮小�??��?, './manual/zoom-out-demo.gif')}
                    </div>
                `
            },
            // Page 4: Smart Tools
            {
                tabName: "?�慧工具",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">4. ?�慧?��??�修�?(1/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-magic', '一?�去??, '?�自?�辨識主要主體並移除?�景??br><span class="text-orange-500 font-bold">??等�?模�??��??�要�?點�???/span>', './manual/auto-rmbg-demo.gif')}
                        ${this.generateToolBlock('fas fa-eraser', '塗抹修�?', '塗抹?��?修飾?��??��?AI ?�自?�填補�?br><span class="text-orange-500 font-bold">??等�?模�??��??�要�?點�???/span>', './manual/brush-inpaint-demo.gif')}
                        ${this.generateToolBlock('fas fa-cut', '?��??��?', '框選?��??��??��??��??��?對該範�??��?主�??��???br><span class="text-orange-500 font-bold">??等�?模�??��??�要�?點�???/span>', './manual/area-rmbg-demo.gif')}
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">?�慧?��??�修�?(2/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-band-aid', '?�慧修�?', '框選不�??�物件�?讓�?一秒�?失�?, './manual/inpaint-demo.gif')}
                        ${this.generateToolBlock('fas fa-font', '?�慧辨�? (OCR)', '框選?��??��?，�??�為純�?字�?, './manual/ocr-demo.gif')}
                        ${this.generateToolBlock('fas fa-square', '純色覆�?', '?��?顏色並�??��??��??��?訊�?, './manual/solid-fill-demo.gif')}
                    </div>
                `
            },
            // Page 5: Add Objects
            {
                tabName: "?�入?�件",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">5. ?�入?�物�?(1/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-text-width', '?��??��?', '點�??��??��??��?，支?��?種中?��?字�???, './manual/text-demo.gif')}
                        ${this.generateToolBlock('fas fa-table', '建�?表格', '繪製?�調?��??�寬度�??�景?��?表格??, './manual/table-demo.gif')}
                    </div>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">?�入?�物�?(2/2)</h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-qrcode', 'QR 條碼', '輸入網�?，�??�產?��???QR 條碼??, './manual/qrcode-demo.gif')}
                        ${this.generateToolBlock('fas fa-image', '外部?��?', '上傳?�腦中�??��? (JPG/PNG)??, './manual/image-demo.gif')}
                    </div>
                `
            },
            // Page 6: Misc Settings
            {
                tabName: "?��?設�?",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-4">6. ?��?比�?說�?</h3>
                    <p class="text-slate-600 mb-4">?�畫?�左上�?，您?�以?��?調整?��??�長寬�?例�?</p>
                    <div class="sketch p-2 bg-slate-50 w-full mx-auto mb-6">
                        <img src="./manual/ratio-switch-demo.gif" alt="比�??��?" class="w-full rounded block">
                    </div>
                    <ul class="list-disc pl-5 text-slate-600 space-y-3">
                        <li><strong>16:9 (?��?)�?/strong> ?��? YouTube 封面?�寬?��?簡報??/li>
                        <li><strong>4:3 (?��?)�?/strong> ?��??�統?��??��??��??��??��?/li>
                        <li><strong>橫�? / ?��? (PDF)�?/strong> ??PDF 工�??�專用，�?定�?�?A4 比�?，可依�?求�??��?張方?��?/li>
                    </ul>
                `,
                right: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6">7. ?��?角工?�說??/h3>
                    <div class="space-y-8">
                        ${this.generateToolBlock('fas fa-expand', '?�螢幕模�?, '?��??�?�干?��?專注?�畫布編輯�?, './manual/fullscreen-demo.mp4')}
                        ${this.generateToolBlock('fas fa-layer-group', '?�層快速�?�?, '快速查?��?調整?�件?��?後�?層�?序�?, './manual/layers-demo.gif')}
                        ${this.generateToolBlock('fas fa-comment-dots', '?��?評�?', '?��??��??�在?��?上進�??��?討�???, './manual/comments-demo.gif')}
                    </div>
                `
            },
            // Page 7: API Architecture
            {
                tabName: "後台??API",
                left: `
                    <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6"><i class="fas fa-server mr-2"></i> 8. 後台??API ?��?說�?</h3>
                    <p class="text-slate-600 text-lg leading-relaxed mb-4">?�系統�??�智?�工?�」採?�模組�?設�?，目?�透�?串接?��? API ?��?強大??AI ?��??��??�以下為?��?串接?��??��??��?</p>
                    
                    <div class="space-y-4 mt-6">
                        <div class="p-4 bg-orange-50 border-l-4 border-orange-400 rounded-r shadow-sm">
                            <h4 class="font-bold text-orange-800 text-lg mb-1">簡報�?? (PPT / PPTX)</h4>
                            <p class="text-slate-600 text-sm">?��?串接系統�?span class="font-mono bg-white px-1 rounded text-orange-600">ConvertAPI</span></p>
                            <p class="text-slate-500 text-sm mt-1">?�途�?將�?業常見�? PPT 簡報?�端轉�??��?�?PDF，以?�匯?�畫布�??��??�面專�???/p>
                        </div>

                        <div class="p-4 bg-indigo-50 border-l-4 border-indigo-400 rounded-r shadow-sm">
                            <h4 class="font-bold text-indigo-800 text-lg mb-1">?�慧辨�? (OCR)</h4>
                            <p class="text-slate-600 text-sm">?��?串接系統�?span class="font-mono bg-white px-1 rounded text-indigo-600">OpenAI Vision API (GPT-4o)</span></p>
                            <p class="text-slate-500 text-sm mt-1">?�途�?辨�?複�??�面?��?寫�?體�?多�?語�???/p>
                        </div>
                        
                        <div class="p-4 bg-teal-50 border-l-4 border-teal-400 rounded-r shadow-sm">
                            <h4 class="font-bold text-teal-800 text-lg mb-1">塗抹修�? / ?�慧修�?</h4>
                            <p class="text-slate-600 text-sm">?��?串接系統�?span class="font-mono bg-white px-1 rounded text-teal-600">Photoroom API (Inpainting)</span></p>
                            <p class="text-slate-500 text-sm mt-1">?�途�??��??��?�?AI ?�縫填�?移除?�件後�??�景??/p>
                        </div>
                    </div>
                `,
                right: `
                    <div>
                        <h3 class="text-2xl font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 mb-6"><i class="fas fa-exchange-alt mr-2"></i> ?��??��?術替?�方�?/h3>
                        <p class="text-slate-600 text-lg leading-relaxed mb-6">?�系統�?底層介面已�?度�?準�?，具?�極高�??��??�。若?��??��??��?安�??��??�求�??��??�模組�??�無縫替?�為以�??��?�?/p>
                        
                        <ul class="list-disc pl-6 text-slate-600 space-y-6 text-lg">
                            <li>
                                <strong>OCR ?�慧辨�? (?�代?��?)</strong><br>
                                <span class="text-sm text-slate-500">?��? OpenAI ?�端?��??��??��??�端?�緣?��???<code class="text-indigo-500">Tesseract.js</code>，�??�網?�建??<code class="text-indigo-500">Ollama (Vision)</code> 模�?，實?��??�斷網辨識�?/span>
                            </li>
                            <li>
                                <strong>AI 塗抹修�? (?�代?��?)</strong><br>
                                <span class="text-sm text-slate-500">?��?使用 Photoroom ?�端?��?，未來可串接私�??�署??<code class="text-indigo-500">Stable Diffusion</code> 伺�??��??��?源�? <code class="text-indigo-500">Lama Cleaner</code>，確保修?��??��?外�???/span>
                            </li>
                            <li>
                                <strong>PPT 簡報�?? (?�代?��?)</strong><br>
                                <span class="text-sm text-slate-500">?��?依賴?��???ConvertAPI ?�端轉�?外�?系統設�??�容?�自?��? <code class="text-indigo-500">LibreOffice (Gotenberg)</code> 伺�??��??�隨?��??�為 100% ?�網?��?轉�??��???/span>
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
            // Because we now have left AND right content changing, 
            // a simple right-flip animation is trickier to look perfect without dual layers.
            // We'll keep the right-flip aesthetic for consistency.
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
