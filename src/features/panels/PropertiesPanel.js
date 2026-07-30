export default class PropertiesPanel {
    constructor(eventBus, canvasEngine) {
        this.eventBus = eventBus;
        this.canvasEngine = canvasEngine; // 為了可以直接 requestRenderAll()
        this.container = document.getElementById('prop-editor-container');
        this.emptyState = document.getElementById('prop-empty-state');
        
        this.activeObject = null;
        
        this.bindEvents();
    }

    bindEvents() {
        this.eventBus.on('CANVAS:OBJECT_SELECTED', (data) => {
            this.activeObject = data.target;
            if (this.isUpdatingFromPanel) return;
            this.renderProperties(data);
        });

        this.eventBus.on('CANVAS:OBJECT_CLEARED', () => {
            if (this.isUpdatingFromPanel) return;
            this.activeObject = null;
            this.showEmptyState();
        });
    }

    showEmptyState() {
        if (this.emptyState) this.emptyState.style.display = 'block';
        if (this.container) {
            this.container.style.display = 'none';
            this.container.innerHTML = '';
        }
    }

    renderProperties(data) {
        if (!this.emptyState || !this.container) return;
        
        if (data.target && data.target.isCropBox) {
            // 當選取裁切框時，不更新右側面板，保留原圖片屬性 UI
            return;
        }

        this.emptyState.style.display = 'none';
        this.container.style.display = 'block';

        let html = '';

        if (data.type === 'i-text' || data.type === 'text' || data.type === 'textbox') {
            html += this.renderTextPropertiesUI(data);
        } else if (data.target && data.target.isQRCode) {
            html += this.renderQRCodePropertiesUI(data);
        } else if (data.type === 'image') {
            html += this.renderImagePropertiesUI(data);
        } else if (data.target && data.target.isTable) {
            html += this.renderTablePropertiesUI(data);
        } else {
            const typeName = data.type === 'rect' ? '矩形' :
                             data.type === 'circle' ? '圓形' :
                             data.type === 'path' ? '手繪路徑' : 
                             data.type === 'group' ? '群組' : data.type;
            
            html += `
                <div class="border-b-2 border-slate-700 pb-2 mb-4 flex justify-between items-center">
                    <h3 class="text-xs font-bold text-slate-800">物件類型：${typeName}</h3>
                    <button id="btn-prop-delete" class="text-rose-500 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
        }

        if (data.type !== 'i-text' && data.type !== 'text' && data.type !== 'textbox' && data.type !== 'image' && (!data.target || (!data.target.isQRCode && !data.target.isTable))) {
            // 填充顏色 (針對支援 fill 的物件)
            if (data.type !== 'path') {
                html += `
                    <div class="mb-4">
                        <label class="block text-[10px] font-bold text-slate-500 mb-1">填充顏色 (Fill)</label>
                        <div class="flex items-center gap-2">
                            <input type="color" id="prop-fill" value="${data.fill || '#000000'}" class="w-8 h-8 sketch-btn p-0 cursor-pointer">
                            <span class="text-xs font-bold text-slate-700" id="prop-fill-text">${data.fill || '透明'}</span>
                        </div>
                    </div>
                `;
            }

            // 邊框顏色
            html += `
                <div class="mb-4">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">邊框顏色 (Stroke)</label>
                    <div class="flex items-center gap-2">
                        <input type="color" id="prop-stroke" value="${data.stroke || '#000000'}" class="w-8 h-8 sketch-btn p-0 cursor-pointer">
                        <span class="text-xs font-bold text-slate-700" id="prop-stroke-text">${data.stroke || '無'}</span>
                    </div>
                </div>
            `;

            // 邊框寬度
            html += `
                <div class="mb-4">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1 flex justify-between">
                        <span>邊框粗細 (Stroke Width)</span>
                        <span id="prop-strokeWidth-val" class="text-indigo-600">${data.strokeWidth || 0}px</span>
                    </label>
                    <input type="range" id="prop-strokeWidth" min="0" max="20" value="${data.strokeWidth || 0}" class="w-full accent-indigo-500">
                </div>
            `;
            
            // 透明度
            html += `
                <div class="mb-4">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1 flex justify-between">
                        <span>透明度 (Opacity)</span>
                        <span id="prop-opacity-val" class="text-indigo-600">${Math.round((data.opacity || 1) * 100)}%</span>
                    </label>
                    <input type="range" id="prop-opacity" min="0" max="100" value="${(data.opacity || 1) * 100}" class="w-full accent-indigo-500">
                </div>
            `;
        }

        // 存入素材庫按鈕
        if (data.type !== 'image') {
            html += `
                <div class="mt-6 pt-4 border-t-2 border-slate-700">
                    <button id="btn-save-to-assets" class="w-full sketch-btn py-2 text-sm font-bold flex items-center justify-center gap-2 text-indigo-700 bg-indigo-50 border-indigo-700">
                        <i class="fas fa-bookmark"></i> 儲存至素材庫
                    </button>
                </div>
            `;
        }

        this.container.innerHTML = html;

        // 綁定輸入事件 (雙向綁定)
        this.bindInputEvents();
    }

    bindInputEvents() {
        const fillInput = document.getElementById('prop-fill');
        const fillText = document.getElementById('prop-fill-text');
        if (fillInput) {
            fillInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (fillText) fillText.innerText = val;
                if (this.activeObject) {
                    this.activeObject.set('fill', val);
                    this.canvasEngine.canvas.requestRenderAll();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                }
            });
        }

        const strokeInput = document.getElementById('prop-stroke');
        const strokeText = document.getElementById('prop-stroke-text');
        if (strokeInput) {
            strokeInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (strokeText) strokeText.innerText = val;
                if (this.activeObject) {
                    this.activeObject.set('stroke', val);
                    this.canvasEngine.canvas.requestRenderAll();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                }
            });
        }

        const swInput = document.getElementById('prop-strokeWidth');
        const swVal = document.getElementById('prop-strokeWidth-val');
        if (swInput) {
            swInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value);
                if (swVal) swVal.innerText = `${val}px`;
                if (this.activeObject) {
                    this.activeObject.set('strokeWidth', val);
                    this.canvasEngine.canvas.requestRenderAll();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                }
            });
        }
        
        const opacityInput = document.getElementById('prop-opacity');
        const opacityVal = document.getElementById('prop-opacity-val');
        if (opacityInput) {
            opacityInput.addEventListener('input', (e) => {
                const val = parseInt(e.target.value) / 100;
                if (opacityVal) opacityVal.innerText = `${Math.round(val * 100)}%`;
                if (this.activeObject) {
                    this.activeObject.set('opacity', val);
                    this.canvasEngine.canvas.requestRenderAll();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                }
            });
        }

        const btnSaveAsset = document.getElementById('btn-save-to-assets');
        if (btnSaveAsset) {
            btnSaveAsset.addEventListener('click', () => {
                if (this.activeObject) {
                    // 將選取的物件匯出為 Base64 (PNG格式以保留透明度)
                    const dataUrl = this.activeObject.toDataURL({
                        format: 'png',
                        multiplier: 2 // 提高畫質
                    });
                    this.eventBus.emit('ASSETS:SAVE', dataUrl);
                }
            });
        }
        
        const btnDelete = document.getElementById('btn-prop-delete');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => {
                if (this.activeObject) {
                    this.canvasEngine.canvas.remove(this.activeObject);
                    this.canvasEngine.canvas.discardActiveObject();
                    this.canvasEngine.canvas.requestRenderAll();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                }
            });
        }

        // 綁定文字專用事件
        if (this.activeObject && (this.activeObject.type === 'i-text' || this.activeObject.type === 'text' || this.activeObject.type === 'textbox')) {
            this.bindTextEvents();
        }

        // 綁定 QR Code 專用事件
        if (this.activeObject && this.activeObject.isQRCode) {
            this.bindQRCodeEvents();
        }

        // 綁定圖片專用事件
        if (this.activeObject && this.activeObject.type === 'image' && !this.activeObject.isQRCode) {
            this.bindImageEvents();
        }

        // 綁定表格專用事件
        if (this.activeObject && this.activeObject.isTable) {
            this.bindTableEvents();
        }
    }

    renderTextPropertiesUI(data) {
        // 從資料庫中讀取對齊方式，預設靠左
        const align = data.target.textAlign || 'left';
        
        return `
            <div class="border-b-2 border-slate-700 pb-2 mb-4 flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800"><i class="fas fa-font mr-1"></i> 文字屬性</h3>
                <button id="btn-prop-delete" class="text-rose-500 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
            </div>
            <div class="relative mb-4">
                <button id="btn-ai-magic" class="w-full sketch-btn py-2 text-sm font-bold flex items-center justify-center gap-2 text-indigo-700 bg-purple-50 border-purple-800">
                    <i class="fas fa-magic text-purple-500"></i> ✨ AI 魔法助理
                </button>
                <div id="ai-magic-dropdown" class="hidden absolute top-full left-0 w-full mt-1 bg-white sketch-panel z-10 p-2 space-y-1 text-sm shadow-xl">
                    <button class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded transition flex items-center gap-2 text-slate-700" data-ai-action="polish">
                        <i class="fas fa-pencil-alt text-orange-400"></i> 潤飾文字 (讓語句更通順)
                    </button>
                    <button class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded transition flex items-center gap-2 text-slate-700" data-ai-action="professional">
                        <i class="fas fa-user-tie text-blue-600"></i> 語氣變專業 (適合商業)
                    </button>
                    <button class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded transition flex items-center gap-2 text-slate-700" data-ai-action="casual">
                        <i class="fas fa-party-horn text-pink-500"></i> 語氣變輕鬆 (適合社群)
                    </button>
                    <button class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded transition flex items-center gap-2 text-slate-700" data-ai-action="shorten">
                        <i class="fas fa-compress-alt text-purple-400"></i> 縮短長度 (提煉重點)
                    </button>
                    <button class="w-full text-left px-3 py-2 hover:bg-slate-50 rounded transition flex items-center gap-2 text-slate-700" data-ai-action="translate">
                        <i class="fas fa-globe text-blue-400"></i> 翻譯成英文 (雙語切換)
                    </button>
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">文字內容</label>
                <textarea id="prop-text-content" rows="3" class="w-full sketch p-2 text-sm text-slate-700 resize-none outline-none focus:border-indigo-500">${data.target.text}</textarea>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">字體大小</label>
                    <input type="number" id="prop-font-size" value="${data.target.fontSize || 32}" class="w-full sketch px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-indigo-500">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">文字顏色</label>
                    <div class="flex items-center gap-2 sketch px-2 py-1 text-sm text-slate-700 bg-white">
                        <input type="color" id="prop-text-fill" value="${data.target.fill || '#334155'}" class="w-6 h-6 p-0 border-0 cursor-pointer bg-transparent">
                        <span id="prop-text-fill-val" class="font-bold flex-1 text-center">${data.target.fill || '#334155'}</span>
                    </div>
                </div>
            </div>
            
            <div class="mb-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">文字字型</label>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <span class="text-[9px] text-slate-400 block mb-1">英數字型</span>
                        <select id="prop-font-en" class="w-full sketch px-2 py-1 text-sm text-slate-700 outline-none">
                            <option value="(跟隨中文)" ${data.target.fontEn === '(跟隨中文)' || !data.target.fontEn ? 'selected' : ''}>預設 (跟隨中文)</option>
                            <option value="Arial" ${data.target.fontEn === 'Arial' ? 'selected' : ''}>Arial</option>
                            <option value="Helvetica" ${data.target.fontEn === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                            <option value="Roboto" ${data.target.fontEn === 'Roboto' ? 'selected' : ''}>Roboto</option>
                            <option value="Tahoma" ${data.target.fontEn === 'Tahoma' ? 'selected' : ''}>Tahoma</option>
                            <option value="Trebuchet MS" ${data.target.fontEn === 'Trebuchet MS' ? 'selected' : ''}>Trebuchet MS</option>
                            <option value="Impact" ${data.target.fontEn === 'Impact' ? 'selected' : ''}>Impact</option>
                            <option value="Times New Roman" ${data.target.fontEn === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                            <option value="Garamond" ${data.target.fontEn === 'Garamond' ? 'selected' : ''}>Garamond</option>
                            <option value="Courier New" ${data.target.fontEn === 'Courier New' ? 'selected' : ''}>Courier New</option>
                            <option value="Verdana" ${data.target.fontEn === 'Verdana' ? 'selected' : ''}>Verdana</option>
                            <option value="Georgia" ${data.target.fontEn === 'Georgia' ? 'selected' : ''}>Georgia</option>
                            <option value="Comic Sans MS" ${data.target.fontEn === 'Comic Sans MS' ? 'selected' : ''}>Comic Sans MS</option>
                        </select>
                    </div>
                    <div>
                        <span class="text-[9px] text-slate-400 block mb-1">中文字型</span>
                        <select id="prop-font-zh" class="w-full sketch px-2 py-1 text-sm text-slate-700 outline-none">
                            <option value="Noto Sans TC" ${data.target.fontZh === 'Noto Sans TC' || (!data.target.fontZh && data.target.fontFamily === 'Noto Sans TC') ? 'selected' : ''}>Noto Sans TC</option>
                            <option value="微軟正黑體" ${data.target.fontZh === '微軟正黑體' || data.target.fontFamily === '微軟正黑體' ? 'selected' : ''}>微軟正黑體</option>
                            <option value="標楷體" ${data.target.fontZh === '標楷體' || data.target.fontFamily === '標楷體' ? 'selected' : ''}>標楷體</option>
                            <option value="新細明體" ${data.target.fontZh === '新細明體' || data.target.fontFamily === '新細明體' ? 'selected' : ''}>新細明體</option>
                            <option value="微軟雅黑" ${data.target.fontZh === '微軟雅黑' || data.target.fontFamily === '微軟雅黑' ? 'selected' : ''}>微軟雅黑</option>
                            <option value="蘋方-繁" ${data.target.fontZh === '蘋方-繁' || data.target.fontFamily === '蘋方-繁' ? 'selected' : ''}>蘋方-繁 (Mac)</option>
                            <option value="黑體-繁" ${data.target.fontZh === '黑體-繁' || data.target.fontFamily === '黑體-繁' ? 'selected' : ''}>黑體-繁 (Mac)</option>
                            <option value="sans-serif" ${data.target.fontZh === 'sans-serif' || data.target.fontFamily === 'sans-serif' ? 'selected' : ''}>預設黑體</option>
                            <option value="serif" ${data.target.fontZh === 'serif' || data.target.fontFamily === 'serif' ? 'selected' : ''}>預設明體</option>
                            <option value="monospace" ${data.target.fontZh === 'monospace' || data.target.fontFamily === 'monospace' ? 'selected' : ''}>等寬字體</option>
                        </select>
                    </div>

                </div>
                <button class="text-[10px] text-indigo-600 font-bold mt-2 hover:underline"><i class="fas fa-plus"></i> 載入自訂字體</button>
            </div>
            
            <div class="mb-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">文字樣式與對齊</label>
                <div class="grid grid-cols-2 gap-2">
                    <div class="sketch flex bg-white" id="prop-text-style">
                        <button data-style="bold" class="flex-1 py-1.5 text-slate-500 hover:text-indigo-600 border-r border-slate-300 ${data.target.fontWeight === 'bold' ? 'text-indigo-600 bg-indigo-50' : ''}"><i class="fas fa-bold"></i></button>
                        <button data-style="italic" class="flex-1 py-1.5 text-slate-500 hover:text-indigo-600 border-r border-slate-300 ${data.target.fontStyle === 'italic' ? 'text-indigo-600 bg-indigo-50' : ''}"><i class="fas fa-italic"></i></button>
                        <button data-style="underline" class="flex-1 py-1.5 text-slate-500 hover:text-indigo-600 ${data.target.underline ? 'text-indigo-600 bg-indigo-50' : ''}"><i class="fas fa-underline"></i></button>
                    </div>
                    <div class="sketch flex bg-white" id="prop-text-align">
                        <button data-align="left" class="flex-1 py-1.5 text-slate-500 hover:text-indigo-600 border-r border-slate-300 ${align === 'left' ? 'text-indigo-600 bg-indigo-50' : ''}"><i class="fas fa-align-left"></i></button>
                        <button data-align="center" class="flex-1 py-1.5 text-slate-500 hover:text-indigo-600 border-r border-slate-300 ${align === 'center' ? 'text-indigo-600 bg-indigo-50' : ''}"><i class="fas fa-align-center"></i></button>
                        <button data-align="right" class="flex-1 py-1.5 text-slate-500 hover:text-indigo-600 border-r border-slate-300 ${align === 'right' ? 'text-indigo-600 bg-indigo-50' : ''}"><i class="fas fa-align-right"></i></button>
                        <button data-align="justify" class="flex-1 py-1.5 text-slate-500 hover:text-indigo-600 ${align === 'justify' ? 'text-indigo-600 bg-indigo-50' : ''}"><i class="fas fa-align-justify"></i></button>
                    </div>
                </div>
            </div>
            
            <div class="bg-indigo-50 text-indigo-600 border border-indigo-200 rounded p-2 text-[10px] font-bold text-center">
                點擊畫布上的文字即可編輯
            </div>
        `;
    }

    bindTextEvents() {
        const textContent = document.getElementById('prop-text-content');
        if (textContent) {
            textContent.addEventListener('input', (e) => {
                this.activeObject.set('text', e.target.value);
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY', true);
            });
            // 監聽畫布上直接編輯時，同步回屬性面板
            this.activeObject.on('changed', () => {
                textContent.value = this.activeObject.text;
            });
        }
        
        const btnAiMagic = document.getElementById('btn-ai-magic');
        const aiMagicDropdown = document.getElementById('ai-magic-dropdown');
        if (btnAiMagic && aiMagicDropdown) {
            btnAiMagic.addEventListener('click', () => {
                aiMagicDropdown.classList.toggle('hidden');
            });
            
            // 點擊外部關閉選單
            const closeDropdown = (e) => {
                if (!btnAiMagic.contains(e.target) && !aiMagicDropdown.contains(e.target)) {
                    aiMagicDropdown.classList.add('hidden');
                }
            };
            document.addEventListener('click', closeDropdown);
            
            // 綁定各個 AI 功能
            const aiButtons = aiMagicDropdown.querySelectorAll('button[data-ai-action]');
            aiButtons.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const action = e.currentTarget.dataset.aiAction;
                    aiMagicDropdown.classList.add('hidden');
                    
                    const text = this.activeObject.text;
                    if (!text) return;
                    
                    let prompt = "";
                    switch (action) {
                        case 'polish':
                            prompt = "請幫我潤飾以下這段文字，讓語句更通順。請直接輸出修改後的結果，不要加入任何其他的開場白或說明。原文：\n" + text;
                            break;
                        case 'professional':
                            prompt = "請幫我將以下這段文字的語氣改寫得更專業，適合用於商業場合。請直接輸出修改後的結果，不要加入任何其他的開場白或說明。原文：\n" + text;
                            break;
                        case 'casual':
                            prompt = "請幫我將以下這段文字的語氣改寫得更輕鬆自然，適合用於社群媒體發文。請直接輸出修改後的結果，不要加入任何其他的開場白或說明。原文：\n" + text;
                            break;
                        case 'shorten':
                            prompt = "請幫我縮短以下這段文字的長度，提煉出重點。請直接輸出修改後的結果，不要加入任何其他的開場白或說明。原文：\n" + text;
                            break;
                        case 'translate':
                            prompt = "請幫我將以下這段文字翻譯成流暢的英文。如果原本就是英文，請翻譯成繁體中文。請直接輸出修改後的結果，不要加入任何其他的開場白或說明。原文：\n" + text;
                            break;
                    }
                    
                    const originalText = text;
                    btnAiMagic.innerHTML = '<i class="fas fa-spinner fa-spin text-purple-500"></i> AI 處理中...';
                    btnAiMagic.classList.add('opacity-50', 'pointer-events-none');

                    try {
                        const response = await fetch("http://10.1.1.103:11435/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": "Bearer token-123qwe"
                            },
                            body: JSON.stringify({
                                model: "nemotron-omni",
                                messages: [{ role: "user", content: prompt }],
                                max_tokens: 1024,
                                temperature: 0.3
                            })
                        });

                        if (!response.ok) throw new Error(`API 錯誤: ${response.status}`);
                        const data = await response.json();
                        
                        const message = data.choices[0].message;
                        let newText = message.content || "";
                        let reasoningText = message.reasoning_content || "";
                        
                        if (newText) {
                            newText = newText.trim();
                            // 檢查是否包含 <think> 標籤
                            const thinkMatch = newText.match(/<think>([\s\S]*?)<\/think>/i);
                            if (thinkMatch) {
                                reasoningText = thinkMatch[1].trim();
                                newText = newText.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
                            }
                        }
                        
                        if (!newText && reasoningText) {
                            newText = "模型僅回傳了思考邏輯，並未給出最終結果。";
                        } else if (!newText) {
                            newText = originalText;
                        }
                        
                        // 顯示彈窗
                        this.showAiModal(originalText, reasoningText, newText, textContent);
                    } catch (err) {
                        alert("AI 處理失敗: " + err.message + "\n(請確認內網 10.1.1.103 伺服器是否有啟動)");
                        this.activeObject.set('text', originalText);
                        this.canvasEngine.canvas.requestRenderAll();
                    } finally {
                        btnAiMagic.innerHTML = '<i class="fas fa-magic text-purple-500"></i> ✨ AI 魔法助理';
                        btnAiMagic.classList.remove('opacity-50', 'pointer-events-none');
                    }
                });
            });
        }

        const fontSize = document.getElementById('prop-font-size');
        if (fontSize) {
            fontSize.addEventListener('input', (e) => {
                this.activeObject.set('fontSize', parseInt(e.target.value) || 32);
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY', true);
            });
        }

        const textFill = document.getElementById('prop-text-fill');
        const textFillVal = document.getElementById('prop-text-fill-val');
        if (textFill) {
            textFill.addEventListener('input', (e) => {
                this.activeObject.set('fill', e.target.value);
                if (textFillVal) textFillVal.innerText = e.target.value;
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY', true);
            });
        }

        const updateTextFont = () => {
            if (!this.activeObject) return;
            const fontEn = document.getElementById('prop-font-en')?.value || '(跟隨中文)';
            const fontZh = document.getElementById('prop-font-zh')?.value || 'Noto Sans TC';
            this.activeObject.set('fontEn', fontEn);
            this.activeObject.set('fontZh', fontZh);
            const fontFamily = fontEn !== '(跟隨中文)' ? `"${fontEn}", "${fontZh}", sans-serif` : fontZh;
            this.activeObject.set('fontFamily', fontFamily);
            this.canvasEngine.canvas.requestRenderAll();
            this.eventBus.emit('CANVAS:DIRTY', true);
        };

        const fontEnSelect = document.getElementById('prop-font-en');
        if (fontEnSelect) fontEnSelect.addEventListener('change', updateTextFont);

        const fontZhSelect = document.getElementById('prop-font-zh');
        if (fontZhSelect) fontZhSelect.addEventListener('change', updateTextFont);

        const styleButtons = document.querySelectorAll('#prop-text-style button');
        styleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const style = e.currentTarget.dataset.style;
                if (style === 'bold') {
                    const current = this.activeObject.fontWeight === 'bold';
                    this.activeObject.set('fontWeight', current ? 'normal' : 'bold');
                    e.currentTarget.classList.toggle('text-indigo-600', !current);
                    e.currentTarget.classList.toggle('bg-indigo-50', !current);
                } else if (style === 'italic') {
                    const current = this.activeObject.fontStyle === 'italic';
                    this.activeObject.set('fontStyle', current ? 'normal' : 'italic');
                    e.currentTarget.classList.toggle('text-indigo-600', !current);
                    e.currentTarget.classList.toggle('bg-indigo-50', !current);
                } else if (style === 'underline') {
                    const current = !!this.activeObject.underline;
                    this.activeObject.set('underline', !current);
                    e.currentTarget.classList.toggle('text-indigo-600', !current);
                    e.currentTarget.classList.toggle('bg-indigo-50', !current);
                }
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY', true);
            });
        });

        const alignButtons = document.querySelectorAll('#prop-text-align button');
        alignButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const align = e.currentTarget.dataset.align;
                this.activeObject.set('textAlign', align);
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY', true);
                
                // 更新 UI
                alignButtons.forEach(b => b.classList.remove('text-indigo-600', 'bg-indigo-50'));
                e.currentTarget.classList.add('text-indigo-600', 'bg-indigo-50');
            });
        });
    }

    renderQRCodePropertiesUI(data) {
        const opts = data.target.qrOptions;
        const fgColor = opts.dotsOptions.color || '#000000';
        const bgColor = opts.backgroundOptions.color || '#ffffff';
        const dotsType = opts.dotsOptions.type || 'square';
        const cornersType = opts.cornersSquareOptions.type || 'square';

        return `
            <div class="border-b-2 border-slate-700 pb-2 mb-4 flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800"><i class="fas fa-qrcode mr-1"></i> QR Code 屬性</h3>
                <button id="btn-prop-delete" class="text-rose-500 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">QR Code 顏色</label>
                    <div class="flex items-center gap-2 sketch px-2 py-1.5 text-sm text-slate-700 bg-white">
                        <input type="color" id="prop-qr-fg" value="${fgColor}" class="w-6 h-6 p-0 border-0 cursor-pointer bg-transparent">
                        <span id="prop-qr-fg-val" class="font-bold flex-1">${fgColor}</span>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">背景顏色</label>
                    <div class="flex items-center gap-2 sketch px-2 py-1.5 text-sm text-slate-700 bg-white">
                        <input type="color" id="prop-qr-bg" value="${bgColor}" class="w-6 h-6 p-0 border-0 cursor-pointer bg-transparent">
                        <span id="prop-qr-bg-val" class="font-bold flex-1">${bgColor}</span>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">外觀樣式 (形狀)</label>
                    <select id="prop-qr-dots" class="w-full sketch px-2 py-1.5 text-sm text-slate-700 outline-none">
                        <option value="square" ${dotsType === 'square' ? 'selected' : ''}>方塊 (Square)</option>
                        <option value="dots" ${dotsType === 'dots' ? 'selected' : ''}>圓點 (Dots)</option>
                        <option value="rounded" ${dotsType === 'rounded' ? 'selected' : ''}>圓角 (Rounded)</option>
                        <option value="extra-rounded" ${dotsType === 'extra-rounded' ? 'selected' : ''}>大圓角 (Extra Rounded)</option>
                        <option value="classy" ${dotsType === 'classy' ? 'selected' : ''}>經典 (Classy)</option>
                        <option value="classy-rounded" ${dotsType === 'classy-rounded' ? 'selected' : ''}>經典圓角 (Classy Rounded)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">眼框樣式 (Corners)</label>
                    <select id="prop-qr-corners" class="w-full sketch px-2 py-1.5 text-sm text-slate-700 outline-none">
                        <option value="square" ${cornersType === 'square' ? 'selected' : ''}>方塊 (Square)</option>
                        <option value="dot" ${cornersType === 'dot' ? 'selected' : ''}>圓點 (Dot)</option>
                        <option value="extra-rounded" ${cornersType === 'extra-rounded' ? 'selected' : ''}>大圓角 (Extra Rounded)</option>
                    </select>
                </div>
            </div>
            
            <div class="bg-indigo-50 text-indigo-600 border border-indigo-200 rounded p-2 text-[10px] font-bold text-center mt-2">
                可自由縮放大小，保持邊緣清晰
            </div>
        `;
    }

    bindQRCodeEvents() {
        const updateQRCode = () => {
            if (!this.activeObject || !this.activeObject.isQRCode) return;
            
            const qrCode = new QRCodeStyling(this.activeObject.qrOptions);
            qrCode.getRawData("png").then((blob) => {
                const qrUrl = URL.createObjectURL(blob);
                this.activeObject.setSrc(qrUrl, () => {
                    this.canvasEngine.canvas.requestRenderAll();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                });
            });
        };

        const fgInput = document.getElementById('prop-qr-fg');
        const fgVal = document.getElementById('prop-qr-fg-val');
        if (fgInput) {
            fgInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (fgVal) fgVal.innerText = val;
                this.activeObject.qrOptions.dotsOptions.color = val;
                updateQRCode();
            });
        }

        const bgInput = document.getElementById('prop-qr-bg');
        const bgVal = document.getElementById('prop-qr-bg-val');
        if (bgInput) {
            bgInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (bgVal) bgVal.innerText = val;
                this.activeObject.qrOptions.backgroundOptions.color = val;
                updateQRCode();
            });
        }

        const dotsSelect = document.getElementById('prop-qr-dots');
        if (dotsSelect) {
            dotsSelect.addEventListener('change', (e) => {
                this.activeObject.qrOptions.dotsOptions.type = e.target.value;
                updateQRCode();
            });
        }

        const cornersSelect = document.getElementById('prop-qr-corners');
        if (cornersSelect) {
            cornersSelect.addEventListener('change', (e) => {
                this.activeObject.qrOptions.cornersSquareOptions.type = e.target.value;
                updateQRCode();
            });
        }
    }

    renderImagePropertiesUI(data) {
        const obj = data.target;
        
        // 解析現有濾鏡值
        let brightness = 0, contrast = 0, saturation = 0, blur = 0;
        if (obj.filters && obj.filters.length > 0) {
            obj.filters.forEach(f => {
                if (f.type === 'Brightness') brightness = f.brightness;
                if (f.type === 'Contrast') contrast = f.contrast;
                if (f.type === 'Saturation') saturation = f.saturation;
                if (f.type === 'Blur') blur = f.blur;
            });
        }
        
        // 預設為 true，如果使用者解鎖，就會是 false
        const isUnlocked = obj.lockUniScaling === false; 
        
        return `
            <div class="border-b-2 border-slate-700 pb-2 mb-4 flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800"><i class="far fa-image mr-1"></i> 圖片屬性</h3>
                <button id="btn-prop-delete" class="text-rose-500 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
            </div>
            
            <div class="text-[10px] text-slate-500 mb-4 font-bold">
                請使用滑鼠拖拉四個角落來縮放保持比例
            </div>
            
            <div class="space-y-2 mb-6 border-b border-slate-200 pb-4">
                <button id="btn-prop-img-download" class="w-full sketch-btn py-2.5 text-sm font-bold flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 border-emerald-600">
                    <i class="fas fa-download"></i> 下載此圖片 (含透明背景)
                </button>
                <button id="btn-prop-img-save" class="w-full sketch-btn py-2.5 text-sm font-bold flex items-center justify-center gap-2 text-blue-600 bg-blue-50 border-blue-200">
                    <i class="fas fa-chart-bar transform rotate-90"></i> 存入素材庫
                </button>
                <button id="btn-prop-img-unlock" class="w-full sketch-btn py-2.5 text-sm font-bold flex items-center justify-center gap-2 text-slate-700 bg-slate-50 border-slate-700">
                    <i class="fas ${isUnlocked ? 'fa-lock' : 'fa-unlock'}"></i> ${isUnlocked ? '鎖定等比例縮放' : '解鎖自由變形'}
                </button>
                <button id="btn-prop-img-crop" class="w-full sketch-btn py-2.5 text-sm font-bold flex items-center justify-center gap-2 text-blue-600 bg-blue-50 border-blue-600">
                    <i class="fas fa-crop-alt"></i> 裁切圖片
                </button>
            </div>
            
            <div class="mb-4">
                <h4 class="text-xs font-bold text-slate-500 mb-4">影像調整 (Filters)</h4>
                
                <div class="mb-5">
                    <label class="block text-[10px] font-bold text-slate-600 mb-1 flex justify-between">
                        <span>亮度 (Brightness): <span id="val-brightness">${brightness.toFixed(2)}</span></span>
                    </label>
                    <input type="range" id="prop-filter-brightness" min="-1" max="1" step="0.05" value="${brightness}" class="w-full accent-blue-500">
                </div>
                
                <div class="mb-5">
                    <label class="block text-[10px] font-bold text-slate-600 mb-1 flex justify-between">
                        <span>對比度 (Contrast): <span id="val-contrast">${contrast.toFixed(2)}</span></span>
                    </label>
                    <input type="range" id="prop-filter-contrast" min="-1" max="1" step="0.05" value="${contrast}" class="w-full accent-blue-500">
                </div>
                
                <div class="mb-5">
                    <label class="block text-[10px] font-bold text-slate-600 mb-1 flex justify-between">
                        <span>飽和度 (Saturation): <span id="val-saturation">${saturation.toFixed(2)}</span></span>
                    </label>
                    <input type="range" id="prop-filter-saturation" min="-1" max="1" step="0.05" value="${saturation}" class="w-full accent-blue-500">
                </div>
                
                <div class="mb-5">
                    <label class="block text-[10px] font-bold text-slate-600 mb-1 flex justify-between">
                        <span>模糊 (Blur): <span id="val-blur">${blur.toFixed(2)}</span></span>
                    </label>
                    <input type="range" id="prop-filter-blur" min="0" max="1" step="0.05" value="${blur}" class="w-full accent-blue-500">
                </div>
                
                <div class="mb-5 mt-6 pt-4 border-t border-slate-200">
                    <label class="block text-[10px] font-bold text-slate-600 mb-1 flex justify-between">
                        <span>透明度 (Opacity): <span id="val-opacity">${Math.round((obj.opacity || 1) * 100)}%</span></span>
                    </label>
                    <input type="range" id="prop-filter-opacity" min="0" max="100" value="${(obj.opacity || 1) * 100}" class="w-full accent-indigo-500">
                </div>
            </div>
        `;
    }

    bindImageEvents() {
        const obj = this.activeObject;
        if (!obj) return;

        const updateFilters = () => {
            const brightness = parseFloat(document.getElementById('prop-filter-brightness').value);
            const contrast = parseFloat(document.getElementById('prop-filter-contrast').value);
            const saturation = parseFloat(document.getElementById('prop-filter-saturation').value);
            const blur = parseFloat(document.getElementById('prop-filter-blur').value);
            
            document.getElementById('val-brightness').innerText = brightness.toFixed(2);
            document.getElementById('val-contrast').innerText = contrast.toFixed(2);
            document.getElementById('val-saturation').innerText = saturation.toFixed(2);
            document.getElementById('val-blur').innerText = blur.toFixed(2);
            
            obj.filters = [];
            if (brightness !== 0) obj.filters.push(new fabric.Image.filters.Brightness({ brightness }));
            if (contrast !== 0) obj.filters.push(new fabric.Image.filters.Contrast({ contrast }));
            if (saturation !== 0) obj.filters.push(new fabric.Image.filters.Saturation({ saturation }));
            if (blur !== 0) obj.filters.push(new fabric.Image.filters.Blur({ blur }));
            
            obj.applyFilters();
            this.canvasEngine.canvas.requestRenderAll();
            this.eventBus.emit('CANVAS:DIRTY', true);
        };

        ['brightness', 'contrast', 'saturation', 'blur'].forEach(f => {
            const el = document.getElementById(`prop-filter-${f}`);
            if (el) el.addEventListener('input', updateFilters);
        });
        
        const opacityEl = document.getElementById('prop-filter-opacity');
        if (opacityEl) {
            opacityEl.addEventListener('input', (e) => {
                const val = parseInt(e.target.value) / 100;
                document.getElementById('val-opacity').innerText = `${Math.round(val * 100)}%`;
                obj.set('opacity', val);
                this.canvasEngine.canvas.requestRenderAll();
                this.eventBus.emit('CANVAS:DIRTY', true);
            });
        }
        
        const btnDownload = document.getElementById('btn-prop-img-download');
        if (btnDownload) {
            btnDownload.addEventListener('click', () => {
                const dataUrl = obj.toDataURL({ format: 'png', multiplier: 2 });
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = `image_${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
        }
        
        const btnSave = document.getElementById('btn-prop-img-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const dataUrl = obj.toDataURL({ format: 'png', multiplier: 2 });
                this.eventBus.emit('ASSETS:SAVE', dataUrl);
            });
        }

        
        const btnUnlock = document.getElementById('btn-prop-img-unlock');
        if (btnUnlock) {
            btnUnlock.addEventListener('click', () => {
                const isCurrentlyUnlocked = obj.lockUniScaling === false; 
                const nextLockState = isCurrentlyUnlocked; // If it was unlocked (false), we lock it (true)
                
                obj.set('lockUniScaling', nextLockState); 
                // 當 lockUniScaling 為 true (鎖定比例) 時，我們隱藏四邊的控制點，防止非等比縮放
                // 當 lockUniScaling 為 false (自由變形) 時，我們顯示四邊的控制點
                obj.setControlsVisibility({
                    mt: !nextLockState,
                    mb: !nextLockState,
                    ml: !nextLockState,
                    mr: !nextLockState
                });
                
                this.canvasEngine.canvas.requestRenderAll();
                this.renderProperties({ type: 'image', target: obj }); // 重繪 UI 來更新按鈕文字
                this.eventBus.emit('CANVAS:DIRTY', true);
            });
        }
        
        const btnCrop = document.getElementById('btn-prop-img-crop');
        if (btnCrop) {
            btnCrop.addEventListener('click', () => {
                this.enterCropMode(obj);
            });
        }
    }

    enterCropMode(targetImage) {
        const canvas = this.canvasEngine.canvas;
        
        // 1. 保留右側面板原本的屬性介面 (不修改 this.container.innerHTML)

        // 2. 鎖定所有其他物件
        const originalSelectableStates = new Map();
        canvas.getObjects().forEach(o => {
            originalSelectableStates.set(o, o.selectable);
            o.set('selectable', false);
            o.set('evented', false);
        });

        // 3. 建立裁切框 (使用邏輯座標，確保完全對齊圖片的邊界，無論是否有旋轉或縮放)
        const coords = targetImage.aCoords;
        const minX = Math.min(coords.tl.x, coords.tr.x, coords.bl.x, coords.br.x);
        const maxX = Math.max(coords.tl.x, coords.tr.x, coords.bl.x, coords.br.x);
        const minY = Math.min(coords.tl.y, coords.tr.y, coords.bl.y, coords.br.y);
        const maxY = Math.max(coords.tl.y, coords.tr.y, coords.bl.y, coords.br.y);

        const cropRect = new fabric.Rect({
            left: minX,
            top: minY,
            originX: 'left',
            originY: 'top',
            width: maxX - minX,
            height: maxY - minY,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            fill: 'rgba(0, 0, 0, 0.1)',
            stroke: '#4f46e5',
            strokeWidth: 2,
            strokeUniform: true, // 縮放時維持邊框粗細不變
            strokeDashArray: [5, 5],
            transparentCorners: false,
            cornerColor: '#4f46e5',
            cornerStrokeColor: '#ffffff',
            cornerSize: 12,
            lockRotation: true,
            hasRotatingPoint: false,
            excludeFromExport: true // 確保不會被存入歷史紀錄，復原時就不會殘留
        });
        
        cropRect.isCropBox = true; // 標記為裁切框

        canvas.add(cropRect);
        canvas.setActiveObject(cropRect);
        canvas.requestRenderAll();
        
        // 4. 在畫布上方建立浮動的「確認 / 取消」按鈕
        const overlayId = 'crop-overlay-buttons';
        let overlay = document.getElementById(overlayId);
        if (overlay) overlay.remove();

        overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.className = 'absolute z-50 flex gap-2 p-2 bg-white rounded-lg shadow-lg border border-slate-200 pointer-events-auto';
        overlay.innerHTML = `
            <button id="btn-crop-overlay-cancel" class="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded">取消</button>
            <button id="btn-crop-overlay-confirm" class="px-3 py-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded">確認裁切</button>
        `;
        document.getElementById('workspace-container').appendChild(overlay);

        const updateOverlayPos = () => {
            if (!document.getElementById(overlayId)) return;
            const bound = cropRect.getBoundingRect();
            const workspaceRect = document.getElementById('workspace-container').getBoundingClientRect();
            const canvasRect = canvas.wrapperEl.getBoundingClientRect();

            // 計算絕對位置 (相對於 workspace-container)
            const left = bound.left + (canvasRect.left - workspaceRect.left) + bound.width / 2;
            const top = bound.top + (canvasRect.top - workspaceRect.top) - 60; // 顯示在虛線框上方 60px

            overlay.style.left = `${left}px`;
            overlay.style.top = `${top}px`;
            overlay.style.transform = 'translateX(-50%)';
        };

        // 初始定位與綁定事件
        updateOverlayPos();
        cropRect.on('moving', updateOverlayPos);
        cropRect.on('scaling', updateOverlayPos);
        canvas.on('mouse:wheel', updateOverlayPos);
        
        // 當裁切框被外部移除時 (例如使用者按下復原 Undo)，自動清除浮動按鈕
        cropRect.on('removed', () => {
            if (document.getElementById(overlayId)) {
                document.getElementById(overlayId).remove();
            }
        });

        const exitCropMode = () => {
            canvas.remove(cropRect);
            if (document.getElementById(overlayId)) {
                document.getElementById(overlayId).remove();
            }
            // 恢復所有物件狀態
            canvas.getObjects().forEach(o => {
                if (originalSelectableStates.has(o)) {
                    o.set('selectable', originalSelectableStates.get(o));
                    o.set('evented', originalSelectableStates.get(o));
                }
            });
            canvas.setActiveObject(targetImage);
            canvas.requestRenderAll();
        };

        // 綁定確認與取消
        document.getElementById('btn-crop-overlay-cancel').addEventListener('click', exitCropMode);
        
        document.getElementById('btn-crop-overlay-confirm').addEventListener('click', () => {
            // 計算裁切框在畫布上的邏輯尺寸與位置
            const cropLeft = cropRect.left;
            const cropTop = cropRect.top;
            const cropWidth = cropRect.width * cropRect.scaleX;
            const cropHeight = cropRect.height * cropRect.scaleY;
            
            // 使用暫存畫布來產生裁切後的圖片
            const tempCanvasEl = document.createElement('canvas');
            tempCanvasEl.width = cropWidth;
            tempCanvasEl.height = cropHeight;
            const tempFabricCanvas = new fabric.StaticCanvas(tempCanvasEl, {
                width: cropWidth,
                height: cropHeight
            });

            targetImage.clone((clonedImg) => {
                // 將複製的圖片平移，使裁切區域的左上角對齊暫存畫布的 (0,0)
                clonedImg.set({
                    left: clonedImg.left - cropLeft,
                    top: clonedImg.top - cropTop
                });
                tempFabricCanvas.add(clonedImg);
                tempFabricCanvas.renderAll();
                
                const croppedDataUrl = tempCanvasEl.toDataURL('image/png');
                
                fabric.Image.fromURL(croppedDataUrl, (newImg) => {
                    newImg.set({
                        left: cropLeft + cropWidth / 2, // 回復 center 原點
                        top: cropTop + cropHeight / 2,
                        originX: 'center',
                        originY: 'center',
                        filters: targetImage.filters || [],
                        lockUniScaling: targetImage.lockUniScaling
                    });
                    
                    // 繼承控制點限制
                    const isLocked = newImg.lockUniScaling;
                    newImg.setControlsVisibility({
                        mt: !isLocked, mb: !isLocked, ml: !isLocked, mr: !isLocked
                    });
                    
                    // 清理舊物件與裁切框
                    canvas.remove(targetImage);
                    exitCropMode(); // 此處會把 cropRect 也移除
                    
                    // 加入新裁切圖
                    this.canvasEngine.addObject(newImg);
                    canvas.setActiveObject(newImg);
                    
                    this.canvasEngine.saveHistory();
                    this.eventBus.emit('CANVAS:DIRTY', true);
                });
            });
        });
    }

    updateTableProperty(key, value) {
        if (!this.activeObject || !this.activeObject.isTable) return;
        
        // Ensure tableConfig exists
        if (!this.activeObject.tableConfig) {
            this.activeObject.tableConfig = {
                rows: 3, cols: 3, cellWidth: 200, cellHeight: 50,
                strokeWidth: 1, strokeColor: '#334155',
                fontEn: '(跟隨中文)', fontZh: 'Noto Sans TC',
                align: 'top-left', 
                borders: { top: true, bottom: true, left: true, right: true, innerH: true, innerV: true },
                fontSize: 16, fontColor: '#334155', template: 'default'
            };
        }
        
        // 舊版升級相容
        if (this.activeObject.tableConfig.borderSetting && !this.activeObject.tableConfig.borders) {
            this.activeObject.tableConfig.borders = { top: true, bottom: true, left: true, right: true, innerH: true, innerV: true };
            delete this.activeObject.tableConfig.borderSetting;
        }
        
        this.activeObject.tableConfig[key] = value;
        
        this.isUpdatingFromPanel = true;
        this.eventBus.emit('CANVAS:UPDATE_TABLE_PROP', {
            target: this.activeObject,
            config: this.activeObject.tableConfig
        });
        this.isUpdatingFromPanel = false;
    }

    bindTableEvents() {
        const attachListener = (id, event, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(event, (e) => {
                    this.updateTableProperty(key, e.target.value);
                });
            }
        };

        const attachClick = (id, callback) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', callback);
            }
        };

        attachListener('prop-table-stroke-w', 'input', 'strokeWidth');
        attachListener('prop-table-stroke-c', 'input', 'strokeColor');
        attachListener('prop-table-font-en', 'change', 'fontEn');
        attachListener('prop-table-font-zh', 'change', 'fontZh');
        attachListener('prop-table-font-size', 'input', 'fontSize');
        attachListener('prop-table-font-color', 'input', 'fontColor');
        attachListener('prop-table-header-font-color', 'input', 'headerFontColor');
        attachListener('prop-table-header-bg-color', 'input', 'headerBgColor');
        attachListener('prop-table-stripe-color', 'input', 'stripeColor');
        attachListener('prop-table-font-en', 'change', 'fontEn');
        attachListener('prop-table-font-zh', 'change', 'fontZh');
        
        const templateEl = document.getElementById('prop-table-template');
        if (templateEl) {
            templateEl.addEventListener('change', (e) => {
                this.updateTableProperty('template', e.target.value);
            });
        }
        
        const hdEl = document.getElementById('prop-table-handdrawn');
        if (hdEl) {
            hdEl.addEventListener('change', (e) => {
                this.updateTableProperty('isHanddrawn', e.target.checked);
            });
        }

        attachClick('btn-table-row-dec', () => {
            const el = document.getElementById('prop-table-rows');
            let val = parseInt(el.value);
            if (val > 1) { val--; el.value = val; this.updateTableProperty('rows', val); }
        });
        attachClick('btn-table-row-inc', () => {
            const el = document.getElementById('prop-table-rows');
            let val = parseInt(el.value);
            if (val < 20) { val++; el.value = val; this.updateTableProperty('rows', val); }
        });

        attachClick('btn-table-col-dec', () => {
            const el = document.getElementById('prop-table-cols');
            let val = parseInt(el.value);
            if (val > 1) { val--; el.value = val; this.updateTableProperty('cols', val); }
        });
        attachClick('btn-table-col-inc', () => {
            const el = document.getElementById('prop-table-cols');
            let val = parseInt(el.value);
            if (val < 20) { val++; el.value = val; this.updateTableProperty('cols', val); }
        });

        // 綁定對齊按鈕
        document.querySelectorAll('.table-align-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const align = e.currentTarget.dataset.align;
                this.updateTableProperty('align', align);
                // 更新按鈕樣式
                document.querySelectorAll('.table-align-btn').forEach(b => {
                    b.classList.remove('bg-indigo-100', 'text-indigo-700');
                    b.querySelector('i').classList.remove('text-indigo-700');
                    b.querySelector('i').classList.add('text-slate-500');
                });
                e.currentTarget.classList.add('bg-indigo-100', 'text-indigo-700');
                e.currentTarget.querySelector('i').classList.add('text-indigo-700');
                e.currentTarget.querySelector('i').classList.remove('text-slate-500');
            });
        });

        // 綁定邊框按鈕
        document.querySelectorAll('.table-border-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const border = e.currentTarget.dataset.border;
                let borders = { ...this.activeObject.tableConfig.borders };
                
                // 整體切換
                if (border === 'all') {
                    borders = { top: true, bottom: true, left: true, right: true, innerH: true, innerV: true };
                } else if (border === 'none') {
                    borders = { top: false, bottom: false, left: false, right: false, innerH: false, innerV: false };
                } else if (border === 'outer') {
                    borders = { top: true, bottom: true, left: true, right: true, innerH: false, innerV: false };
                } else if (border === 'inner') {
                    borders = { top: false, bottom: false, left: false, right: false, innerH: true, innerV: true };
                } else {
                    // 獨立切換
                    if (border === 'inner-h') borders.innerH = !borders.innerH;
                    if (border === 'inner-v') borders.innerV = !borders.innerV;
                    if (border === 'top') borders.top = !borders.top;
                    if (border === 'bottom') borders.bottom = !borders.bottom;
                    if (border === 'left') borders.left = !borders.left;
                    if (border === 'right') borders.right = !borders.right;
                }

                this.updateTableProperty('borders', borders);
                
                // 更新按鈕視覺
                document.querySelectorAll('.table-border-btn').forEach(b => {
                    const type = b.dataset.border;
                    if (['all', 'none', 'outer', 'inner'].includes(type)) {
                        b.classList.remove('bg-indigo-200'); // 這些不維持 high-light
                    } else {
                        let active = false;
                        if (type === 'inner-h') active = borders.innerH;
                        if (type === 'inner-v') active = borders.innerV;
                        if (type === 'top') active = borders.top;
                        if (type === 'bottom') active = borders.bottom;
                        if (type === 'left') active = borders.left;
                        if (type === 'right') active = borders.right;
                        
                        if (active) b.classList.add('bg-indigo-200', 'border-indigo-400');
                        else b.classList.remove('bg-indigo-200', 'border-indigo-400');
                    }
                });
            });
        });
    }

    renderTablePropertiesUI(data) {
        const config = {
            rows: data.target.tableRows || 3, cols: data.target.tableCols || 3, 
            cellWidth: 150, cellHeight: 50,
            strokeWidth: 1.5, strokeColor: '#cbd5e1',
            fontEn: '(跟隨中文)', fontZh: 'Noto Sans TC',
            align: 'middle-center', 
            borders: { top: true, bottom: true, left: true, right: true, innerH: true, innerV: true },
            fontSize: 16, fontColor: '#334155', headerFontColor: '#ffffff', headerBgColor: '#f1f5f9', stripeColor: '#f8fafc', template: 'default',
            ...(data.target.tableConfig || {})
        };
        
        return `
            <div class="border-b-2 border-slate-700 pb-2 mb-4 flex justify-between items-center">
                <h3 class="text-xs font-bold text-slate-800 flex items-center gap-2"><i class="fas fa-table"></i> 表格屬性</h3>
                <button id="btn-prop-delete" class="text-rose-500 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
            </div>

            <div class="grid grid-cols-2 gap-2 mb-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">行數 (Rows)</label>
                    <div class="flex bg-slate-50 border-2 border-slate-700 rounded items-center">
                        <button class="px-2 text-slate-500 hover:bg-slate-200 font-bold" id="btn-table-row-dec">-</button>
                        <input type="text" id="prop-table-rows" value="${config.rows}" class="w-full bg-transparent text-center text-xs font-bold focus:outline-none" readonly>
                        <button class="px-2 text-slate-500 hover:bg-slate-200 font-bold" id="btn-table-row-inc">+</button>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">欄數 (Cols)</label>
                    <div class="flex bg-slate-50 border-2 border-slate-700 rounded items-center">
                        <button class="px-2 text-slate-500 hover:bg-slate-200 font-bold" id="btn-table-col-dec">-</button>
                        <input type="text" id="prop-table-cols" value="${config.cols}" class="w-full bg-transparent text-center text-xs font-bold focus:outline-none" readonly>
                        <button class="px-2 text-slate-500 hover:bg-slate-200 font-bold" id="btn-table-col-inc">+</button>
                    </div>
                </div>
            </div>


            <div class="grid grid-cols-2 gap-2 mb-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">邊框粗細 (Width)</label>
                    <input type="range" id="prop-table-stroke-w" min="0" max="10" value="${config.strokeWidth}" class="w-full accent-indigo-500 mt-2">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">邊框顏色</label>
                    <input type="color" id="prop-table-stroke-c" value="${config.strokeColor}" class="w-full h-8 sketch-btn p-0 cursor-pointer">
                </div>
            </div>
            
            <div class="mb-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">文字字型</label>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block text-[9px] text-slate-400 mb-0.5">英數字型</label>
                        <select id="prop-table-font-en" class="w-full sketch-input px-1 py-1 text-xs font-bold">
                            <option value="(跟隨中文)" ${config.fontEn==='(跟隨中文)'?'selected':''}>預設 (跟隨中文)</option>
                            <option value="Arial" ${config.fontEn==='Arial'?'selected':''}>Arial</option>
                            <option value="Helvetica" ${config.fontEn==='Helvetica'?'selected':''}>Helvetica</option>
                            <option value="Roboto" ${config.fontEn==='Roboto'?'selected':''}>Roboto</option>
                            <option value="Tahoma" ${config.fontEn==='Tahoma'?'selected':''}>Tahoma</option>
                            <option value="Trebuchet MS" ${config.fontEn==='Trebuchet MS'?'selected':''}>Trebuchet MS</option>
                            <option value="Impact" ${config.fontEn==='Impact'?'selected':''}>Impact</option>
                            <option value="Times New Roman" ${config.fontEn==='Times New Roman'?'selected':''}>Times New Roman</option>
                            <option value="Garamond" ${config.fontEn==='Garamond'?'selected':''}>Garamond</option>
                            <option value="Courier New" ${config.fontEn==='Courier New'?'selected':''}>Courier New</option>
                            <option value="Verdana" ${config.fontEn==='Verdana'?'selected':''}>Verdana</option>
                            <option value="Georgia" ${config.fontEn==='Georgia'?'selected':''}>Georgia</option>
                            <option value="Comic Sans MS" ${config.fontEn==='Comic Sans MS'?'selected':''}>Comic Sans MS</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[9px] text-slate-400 mb-0.5">中文字型</label>
                        <select id="prop-table-font-zh" class="w-full sketch-input px-1 py-1 text-xs font-bold">
                            <option value="Noto Sans TC" ${config.fontZh==='Noto Sans TC'?'selected':''}>Noto Sans TC</option>
                            <option value="微軟正黑體" ${config.fontZh==='微軟正黑體'?'selected':''}>微軟正黑體</option>
                            <option value="標楷體" ${config.fontZh==='標楷體'?'selected':''}>標楷體</option>
                            <option value="新細明體" ${config.fontZh==='新細明體'?'selected':''}>新細明體</option>
                            <option value="微軟雅黑" ${config.fontZh==='微軟雅黑'?'selected':''}>微軟雅黑</option>
                            <option value="蘋方-繁" ${config.fontZh==='蘋方-繁'?'selected':''}>蘋方-繁 (Mac)</option>
                            <option value="黑體-繁" ${config.fontZh==='黑體-繁'?'selected':''}>黑體-繁 (Mac)</option>
                            <option value="sans-serif" ${config.fontZh==='sans-serif'?'selected':''}>預設黑體</option>
                            <option value="serif" ${config.fontZh==='serif'?'selected':''}>預設明體</option>
                            <option value="monospace" ${config.fontZh==='monospace'?'selected':''}>等寬字體</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">對齊方式 (Align)</label>
                <div class="w-3/4 mx-auto grid grid-cols-3 gap-0 border-2 border-slate-700 rounded overflow-hidden bg-white">
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-b-2 border-r-2 border-slate-700/20 ${config.align==='top-left'?'bg-indigo-100 text-indigo-700':''}" data-align="top-left"><i class="fas fa-align-left text-[10px] ${config.align==='top-left'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-b-2 border-r-2 border-slate-700/20 ${config.align==='top-center'?'bg-indigo-100 text-indigo-700':''}" data-align="top-center"><i class="fas fa-align-center text-[10px] ${config.align==='top-center'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-b-2 border-slate-700/20 ${config.align==='top-right'?'bg-indigo-100 text-indigo-700':''}" data-align="top-right"><i class="fas fa-align-right text-[10px] ${config.align==='top-right'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-b-2 border-r-2 border-slate-700/20 ${config.align==='middle-left'?'bg-indigo-100 text-indigo-700':''}" data-align="middle-left"><i class="fas fa-align-left text-[10px] ${config.align==='middle-left'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-b-2 border-r-2 border-slate-700/20 ${config.align==='middle-center'?'bg-indigo-100 text-indigo-700':''}" data-align="middle-center"><i class="fas fa-align-center text-[10px] ${config.align==='middle-center'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-b-2 border-slate-700/20 ${config.align==='middle-right'?'bg-indigo-100 text-indigo-700':''}" data-align="middle-right"><i class="fas fa-align-right text-[10px] ${config.align==='middle-right'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-r-2 border-slate-700/20 ${config.align==='bottom-left'?'bg-indigo-100 text-indigo-700':''}" data-align="bottom-left"><i class="fas fa-align-left text-[10px] ${config.align==='bottom-left'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn border-r-2 border-slate-700/20 ${config.align==='bottom-center'?'bg-indigo-100 text-indigo-700':''}" data-align="bottom-center"><i class="fas fa-align-center text-[10px] ${config.align==='bottom-center'?'text-indigo-700':'text-slate-500'}"></i></button>
                    <button class="h-8 flex items-center justify-center hover:bg-slate-100 table-align-btn ${config.align==='bottom-right'?'bg-indigo-100 text-indigo-700':''}" data-align="bottom-right"><i class="fas fa-align-right text-[10px] ${config.align==='bottom-right'?'text-indigo-700':'text-slate-500'}"></i></button>
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">預設邊框</label>
                <div class="grid grid-cols-4 gap-1 mb-2">
                    <button title="全部邊框" class="py-1 text-[10px] font-bold border-2 border-slate-700 rounded hover:bg-slate-100 table-border-btn bg-white" data-border="all"><i class="fas fa-border-all"></i> 全部</button>
                    <button title="無邊框" class="py-1 text-[10px] font-bold border-2 border-slate-700 rounded hover:bg-slate-100 table-border-btn bg-white" data-border="none"><i class="fas fa-border-none"></i> 無</button>
                    <button title="外框線" class="py-1 text-[10px] font-bold border-2 border-slate-700 rounded hover:bg-slate-100 table-border-btn bg-white" data-border="outer"><i class="far fa-square"></i> 外框</button>
                    <button title="內框線" class="py-1 text-[10px] font-bold border-2 border-slate-700 rounded hover:bg-slate-100 table-border-btn bg-white" data-border="inner"><i class="fas fa-plus"></i> 內線</button>
                </div>
                
                <label class="block text-[10px] font-bold text-slate-500 mb-1">自訂邊框 (可複選)</label>
                <div class="grid grid-cols-3 gap-1">
                    <button title="上邊框" class="py-1 flex items-center justify-center gap-1 text-[10px] font-bold border-2 border-slate-300 rounded hover:bg-indigo-50 table-border-btn ${config.borders?.top?'bg-indigo-200 border-indigo-400':''}" data-border="top"><i class="fas fa-minus"></i> 上</button>
                    <button title="下邊框" class="py-1 flex items-center justify-center gap-1 text-[10px] font-bold border-2 border-slate-300 rounded hover:bg-indigo-50 table-border-btn ${config.borders?.bottom?'bg-indigo-200 border-indigo-400':''}" data-border="bottom"><i class="fas fa-minus mt-1"></i> 下</button>
                    <button title="水平內框" class="py-1 flex items-center justify-center gap-1 text-[10px] font-bold border-2 border-slate-300 rounded hover:bg-indigo-50 table-border-btn ${config.borders?.innerH?'bg-indigo-200 border-indigo-400':''}" data-border="inner-h"><i class="fas fa-grip-lines"></i> 內橫</button>
                    <button title="左邊框" class="py-1 flex items-center justify-center gap-1 text-[10px] font-bold border-2 border-slate-300 rounded hover:bg-indigo-50 table-border-btn ${config.borders?.left?'bg-indigo-200 border-indigo-400':''}" data-border="left"><i class="fas fa-minus rotate-90"></i> 左</button>
                    <button title="右邊框" class="py-1 flex items-center justify-center gap-1 text-[10px] font-bold border-2 border-slate-300 rounded hover:bg-indigo-50 table-border-btn ${config.borders?.right?'bg-indigo-200 border-indigo-400':''}" data-border="right"><i class="fas fa-minus rotate-90"></i> 右</button>
                    <button title="垂直內框" class="py-1 flex items-center justify-center gap-1 text-[10px] font-bold border-2 border-slate-300 rounded hover:bg-indigo-50 table-border-btn ${config.borders?.innerV?'bg-indigo-200 border-indigo-400':''}" data-border="inner-v"><i class="fas fa-grip-lines-vertical"></i> 內直</button>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 mb-4">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">字體大小</label>
                    <input type="number" id="prop-table-font-size" value="${config.fontSize}" class="w-full sketch-input px-2 py-1 text-xs font-bold">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">文字顏色</label>
                    <input type="color" id="prop-table-font-color" value="${config.fontColor}" class="w-full h-8 sketch-btn p-0 cursor-pointer">
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-[10px] font-bold text-slate-500 mb-1">表格版式 (Template)</label>
                <select id="prop-table-template" class="w-full sketch-input px-2 py-1.5 text-xs font-bold mb-2">
                    <option value="default" ${config.template==='default'?'selected':''}>預設 (Default)</option>
                    <option value="stripe" ${config.template==='stripe'?'selected':''}>斑馬紋 (Stripe)</option>
                    <option value="header" ${config.template==='header'?'selected':''}>標題底色 (Header)</option>
                </select>

                <div id="prop-table-header-color-group" class="grid grid-cols-2 gap-2 mb-2">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-1">標題背景顏色</label>
                        <input type="color" id="prop-table-header-bg-color" value="${config.headerBgColor}" class="w-full h-8 sketch-btn p-0 cursor-pointer">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 mb-1">標題文字顏色</label>
                        <input type="color" id="prop-table-header-font-color" value="${config.headerFontColor}" class="w-full h-8 sketch-btn p-0 cursor-pointer">
                    </div>
                </div>

                <div id="prop-table-stripe-color-group" class="mb-2">
                    <label class="block text-[10px] font-bold text-slate-500 mb-1">斑馬紋背景顏色</label>
                    <input type="color" id="prop-table-stripe-color" value="${config.stripeColor}" class="w-full h-8 sketch-btn p-0 cursor-pointer">
                </div>

                <label class="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer mt-3">
                    <input type="checkbox" id="prop-table-handdrawn" class="w-4 h-4 accent-indigo-600" ${config.isHanddrawn ? 'checked' : ''}>
                    啟用手繪風格邊線
                </label>
            </div>
        `;
    }

    showAiModal(originalText, reasoningText, newText, textContentInput) {
        const modal = document.getElementById('ai-text-modal');
        if (!modal) return;
        
        const origTextEl = document.getElementById('ai-modal-original-text');
        const finalTextEl = document.getElementById('ai-modal-final-text');
        const btnCancel = document.getElementById('btn-ai-modal-cancel');
        const btnConfirm = document.getElementById('btn-ai-modal-confirm');
        
        origTextEl.innerText = originalText;
        finalTextEl.value = newText;
        
        modal.classList.remove('hidden');
        
        btnCancel.onclick = () => {
            modal.classList.add('hidden');
        };
        
        btnConfirm.onclick = () => {
            const finalVal = finalTextEl.value;
            this.activeObject.set('text', finalVal);
            if (textContentInput) textContentInput.value = finalVal;
            this.canvasEngine.canvas.requestRenderAll();
            this.eventBus.emit('CANVAS:DIRTY', true);
            this.canvasEngine.saveHistory();
            modal.classList.add('hidden');
        };
    }
}
