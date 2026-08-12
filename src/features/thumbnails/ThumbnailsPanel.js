export default class ThumbnailsPanel {
    constructor(eventBus, containerId) {
        this.eventBus = eventBus;
        this.container = document.getElementById(containerId);
        this.pages = [{ id: 'page-1', active: true }];
        
        this.bindEvents();
        this.render();
    }

    bindEvents() {
        this.eventBus.on('WORKSPACE:MODE_CHANGED', (data) => {
            // 根據規格：若處於圖片工作區，必須完全隱藏縮圖面板
            if (data.mode === 'IMAGE' || data.mode === 'IDLE') {
                if(this.container) this.container.style.display = 'none';
            } else if (data.mode === 'PDF') {
                if(this.container) this.container.style.display = 'flex';
                this.render();
            }
        });
        
        const addPageBtn = document.getElementById('btn-add-page');
        if(addPageBtn) {
            addPageBtn.addEventListener('click', () => {
                console.log("[ThumbnailsPanel] btn-add-page clicked");
                this.addPage();
            });
        }
        
        // 接收 Canvas 產生的實時縮圖
        this.eventBus.on('CANVAS:THUMBNAIL_UPDATED', ({ pageId, dataUrl }) => {
            const page = this.pages.find(p => p.id === pageId);
            if (page) {
                page.thumbnail = dataUrl;
                // 直接更新 DOM 以避免觸發整個面板重繪 (保留捲軸位置與效能)
                const imgEl = document.getElementById(`thumb-img-${pageId}`);
                const textEl = document.getElementById(`thumb-text-${pageId}`);
                if (imgEl && textEl) {
                    imgEl.src = dataUrl;
                    imgEl.style.display = 'block';
                    textEl.style.display = 'none';
                }
            }
        });

        // 使用事件委派監聽刪除、複製與切換
        const list = document.getElementById('thumbnails-list');
        if (list) {
            list.addEventListener('click', (e) => {
                console.log("[ThumbnailsPanel] List clicked, target:", e.target);
                const deleteBtn = e.target.closest('.delete-page-btn');
                const copyBtn = e.target.closest('.copy-page-btn');
                const pageItem = e.target.closest('.page-item');
                
                if (deleteBtn) {
                    console.log("[ThumbnailsPanel] Delete btn matched");
                    const id = deleteBtn.dataset.id;
                    this.deletePage(id);
                } else if (copyBtn) {
                    console.log("[ThumbnailsPanel] Copy btn matched");
                    const id = copyBtn.dataset.id;
                    this.copyPage(id);
                } else if (pageItem) {
                    console.log("[ThumbnailsPanel] Page item matched");
                    const id = pageItem.dataset.id;
                    this.switchPage(id);
                }
            });
        }
        // 處理匯入/開啟專案時的重構
        this.eventBus.on('PROJECT:IMPORTED', ({ projectData }) => {
            if (projectData && projectData.pageStates) {
                const incomingPages = projectData.pages || [];
                this.pages = Object.keys(projectData.pageStates).map(id => {
                    const existing = incomingPages.find(p => p.id === id);
                    let thumb = existing ? existing.thumbnail : null;
                    
                    // 若無儲存的縮圖，嘗試直接從該頁畫布物件中提取背景圖 (PDF / PPT / 圖片)
                    if (!thumb && projectData.pageStates[id]) {
                        const bgImg = projectData.pageStates[id].find(o => o.type === 'image' && o.src);
                        if (bgImg && bgImg.src) {
                            thumb = bgImg.src;
                        }
                    }

                    return {
                        id: id,
                        active: id === projectData.currentPageId,
                        thumbnail: thumb || null
                    };
                });
                // 確保至少有一頁 active
                if (!this.pages.find(p => p.active) && this.pages.length > 0) {
                    this.pages[0].active = true;
                }
                this.render();
            }
        });
    }

    addPage() {
        const newId = `page-${Date.now()}`;
        this.pages.forEach(p => p.active = false);
        this.pages.push({ id: newId, active: true });
        
        this.eventBus.emit('PAGE:ADD', { pageId: newId });
        this.eventBus.emit('PAGE:SWITCH', { newPageId: newId });
        this.render();
    }

    deletePage(pageId) {
        if (this.pages.length <= 1) {
            alert("請至少保留一頁！");
            return;
        }
        
        this.pages = this.pages.filter(p => p.id !== pageId);
        if(!this.pages.find(p => p.active)) {
            this.pages[0].active = true;
        }
        
        this.eventBus.emit('PAGE:DELETE', { pageId });
        this.render();
    }

    copyPage(pageId) {
        // 找到要複製的頁面 index
        const sourceIndex = this.pages.findIndex(p => p.id === pageId);
        if (sourceIndex === -1) return;

        // 如果該頁有縮圖，也一併拷貝過來，這樣 UI 馬上就會有一模一樣的縮圖
        const sourceThumbnail = this.pages[sourceIndex].thumbnail;

        const newId = `page-${Date.now()}`;
        this.pages.forEach(p => p.active = false);
        
        // 將新頁面插入到原始頁面的正下方，並設為 active
        const newPage = { id: newId, active: true, thumbnail: sourceThumbnail };
        this.pages.splice(sourceIndex + 1, 0, newPage);
        
        // 1. 通知引擎拷貝背後的 JSON 資料
        this.eventBus.emit('PAGE:COPY', { sourceId: pageId, newId: newId });
        
        // 2. 通知引擎切換到這張新的 (剛拷貝好的) 頁面
        this.eventBus.emit('PAGE:SWITCH', { newPageId: newId });
        
        this.render();
    }

    switchPage(pageId) {
        if (this.pages.find(p => p.active)?.id === pageId) return; // 避免重複切換同頁面

        this.pages.forEach(p => p.active = (p.id === pageId));
        this.eventBus.emit('PAGE:SWITCH', { newPageId: pageId });
        this.render();
    }

    render() {
        const list = document.getElementById('thumbnails-list');
        const count = document.getElementById('thumbnails-count');
        if (!list || !count) return;

        count.innerText = `頁面清單 (${this.pages.length})`;
        list.innerHTML = '';

        this.pages.forEach((page, index) => {
            const bgClass = page.active ? 'bg-blue-50' : 'bg-transparent';
            const borderClass = page.active ? 'border-indigo-400' : 'border-transparent';
            
            const thumbContent = page.thumbnail 
                ? `<img id="thumb-img-${page.id}" src="${page.thumbnail}" class="w-full h-full object-contain bg-white">
                   <span id="thumb-text-${page.id}" style="display:none;" class="text-[10px] text-slate-300 font-bold">空白頁面</span>`
                : `<img id="thumb-img-${page.id}" src="" style="display:none;" class="w-full h-full object-contain bg-white">
                   <span id="thumb-text-${page.id}" class="text-[10px] text-slate-300 font-bold">空白頁面</span>`;
            
            const html = `
                <div class="page-item sketch-panel relative p-2 mb-4 cursor-pointer hover:bg-slate-100 transition ${bgClass} border-2 ${borderClass}" data-id="${page.id}">
                    <div class="aspect-[16/9] bg-white border border-slate-300 flex items-center justify-center relative rounded pointer-events-none overflow-hidden">
                        ${thumbContent}
                    </div>
                    <div class="page-item-title mt-2 ml-1 text-xs font-bold text-slate-700 pointer-events-none">Page ${index + 1}</div>
                    
                    <div class="absolute top-2 left-2 sketch w-6 h-6 bg-indigo-500 text-white flex justify-center items-center text-[10px] font-bold pointer-events-none">
                        ${index + 1}
                    </div>
                    
                    <div class="absolute top-1 right-0 flex flex-col gap-1 z-10">
                        <button class="copy-page-btn sketch w-5 h-5 bg-white text-slate-500 hover:text-slate-800 flex justify-center items-center text-[10px]" data-id="${page.id}">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="delete-page-btn sketch w-5 h-5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white flex justify-center items-center text-[10px] transition" data-id="${page.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            list.insertAdjacentHTML('beforeend', html);
        });
    }
}
