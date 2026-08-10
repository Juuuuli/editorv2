export default class AIProviderAdapter {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.config = this.loadConfig();
        
        // Listen for vault configuration updates
        if (this.eventBus) {
            this.eventBus.on('VAULT:CONFIG_UPDATED', (newConfig) => {
                this.config = newConfig;
            });
        }
    }

    /**
     * 取得當前使用的 LLM 模型名稱 (供 UI 顯示)
     */
    getActiveLlmModelName() {
        const isCustom = this.config.activeLlmType === 'custom';
        if (isCustom) {
            const activeEp = this.config.customEndpoints?.find(e => e.id === this.config.activeCustomId);
            return activeEp?.modelId || '未知自訂模型';
        } else {
            const provider = this.config.builtin?.provider || 'gemini';
            if (provider === 'gemini') {
                return this.config.builtin?.geminiModel || this.config.builtin?.model || 'gemini-1.5-flash';
            } else if (provider === 'openai') {
                return this.config.builtin?.openaiModel || this.config.builtin?.model || 'gpt-4o-mini';
            } else if (provider === 'anthropic') {
                return this.config.builtin?.anthropicModel || this.config.builtin?.model || 'claude-3-5-sonnet-20241022';
            }
            return '未知內建模型';
        }
    }

    loadConfig() {
        const raw = localStorage.getItem('EDITOR_V2_VAULT_CONFIG');
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                console.warn('Failed to parse EDITOR_V2_VAULT_CONFIG', e);
            }
        }
        return {
            activeLlmType: 'builtin',
            builtin: { provider: 'gemini', model: 'gemini-1.5-flash', geminiApiKey: '', openaiApiKey: '' },
            customEndpoints: [], activeCustomId: '',
            imageProcessing: { provider: 'clipdrop', apiKey: '' },
            pptParsing: { provider: 'convertapi', secret: '' }
        };
    }

    /**
     * 呼叫大型語言模型生成文字
     * @param {string} prompt 使用者提示詞
     * @param {string} systemPrompt 系統提示詞 (角色設定)
     * @returns {Promise<string>} 生成的文字結果
     */
    async generateText(prompt, systemPrompt = '') {
        const isCustom = this.config.activeLlmType === 'custom';
        
        if (isCustom) {
            return this._callCustomEndpoint(prompt, systemPrompt);
        } else {
            const provider = this.config.builtin?.provider || 'gemini';
            if (provider === 'gemini') {
                return this._callGemini(prompt, systemPrompt);
            } else if (provider === 'openai') {
                return this._callOpenAI(prompt, systemPrompt);
            } else if (provider === 'anthropic') {
                return this._callAnthropic(prompt, systemPrompt);
            } else {
                throw new Error(`不支援的內建 Provider: ${provider}`);
            }
        }
    }

    async _callGemini(prompt, systemPrompt) {
        const apiKey = this.config.builtin?.geminiApiKey || this.config.builtin?.apiKey;
        if (!apiKey) throw new Error('未設定 Gemini API Key');
        
        let contents = [];
        if (systemPrompt) {
            contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
            contents.push({ role: 'model', parts: [{ text: 'OK.' }] });
        }
        contents.push({ role: 'user', parts: [{ text: prompt }] });
        const payload = { contents };
        
        const candidateModels = Array.from(new Set([
            this.config.builtin?.geminiModel || this.config.builtin?.model || 'gemini-1.5-flash',
            'gemini-2.5-flash',
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-2.0-flash-exp',
            'gemini-1.5-pro-latest'
        ]));

        let lastError = null;
        for (const m of candidateModels) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                } else {
                    const err = await response.json().catch(() => ({}));
                    lastError = new Error(`Gemini API 錯誤 (${m}): ${err.error?.message || response.statusText}`);
                }
            } catch (e) {
                lastError = e;
            }
        }
        
        if (lastError) throw lastError;
        return '';
    }

    async _callOpenAI(prompt, systemPrompt) {
        const apiKey = this.config.builtin?.openaiApiKey || this.config.builtin?.apiKey;
        if (!apiKey) throw new Error('未設定 OpenAI API Key');
        
        const model = this.config.builtin?.openaiModel || this.config.builtin?.model || 'gpt-4o-mini';
        const url = 'https://api.openai.com/v1/chat/completions';
        
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const payload = {
            model,
            messages,
            temperature: 0.7
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OpenAI API 錯誤: ${response.status} ${err}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async _callAnthropic(prompt, systemPrompt) {
        const apiKey = this.config.builtin?.anthropicApiKey;
        if (!apiKey) throw new Error('未設定 Anthropic API Key');
        
        const model = this.config.builtin?.anthropicModel || this.config.builtin?.model || 'claude-3-5-sonnet-20241022';
        const url = 'https://api.anthropic.com/v1/messages';
        
        const payload = {
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
        };
        if (systemPrompt) {
            payload.system = systemPrompt;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Anthropic API 錯誤: ${response.status} ${err}`);
        }

        const data = await response.json();
        return data.content?.[0]?.text || '';
    }

    async _callCustomEndpoint(prompt, systemPrompt) {
        const activeEp = this.config.customEndpoints?.find(e => e.id === this.config.activeCustomId);
        const { baseUrl, modelId, token } = activeEp || {};
        if (!baseUrl) throw new Error('未設定自訂 Endpoint URL');
        
        // Assume OpenAI compatible interface for custom endpoints (like vLLM/Ollama with compatible layer)
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const payload = {
            model: modelId || 'default',
            messages,
            temperature: 0.7
        };

        const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`自訂端點錯誤: ${response.status} ${err}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    /**
     * 一鍵去背
     * @param {Blob|string} imageBlobOrDataUrl 圖片 Blob 或 DataURL
     * @returns {Promise<string>} 回傳結果的 Object URL 或 Data URL
     */
    async removeBackground(imageBlobOrDataUrl) {
        const provider = this.config.imageProcessing?.provider || 'clipdrop';
        
        if (provider === 'mock') {
            return this._mockRemoveBackground();
        } else if (provider === 'clipdrop') {
            return this._callClipdropRemoveBackground(imageBlobOrDataUrl);
        } else if (provider === 'photoroom') {
            return this._callPhotoroomRemoveBackground(imageBlobOrDataUrl);
        } else if (provider === 'removebg') {
            return this._callRemoveBgRemoveBackground(imageBlobOrDataUrl);
        } else if (provider === 'sd') {
            throw new Error('Stable Diffusion 去背目前尚未實作，請選擇其他服務');
        } else {
            throw new Error(`不支援的影像去背 Provider: ${provider}`);
        }
    }

    async _callPhotoroomRemoveBackground(imageBlobOrDataUrl) {
        const apiKey = this.config.imageProcessing?.apiKey;
        if (!apiKey) throw new Error('未設定 Photoroom API Key');

        let blob = imageBlobOrDataUrl;
        if (typeof imageBlobOrDataUrl === 'string' && imageBlobOrDataUrl.startsWith('data:')) {
            blob = await (await fetch(imageBlobOrDataUrl)).blob();
        }

        const formData = new FormData();
        formData.append('imageFile', blob);

        const response = await fetch('https://image-api.photoroom.com/v2/edit', {
            method: 'POST',
            headers: { 'x-api-key': apiKey },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Photoroom 去背失敗: ${response.status} ${errorText}`);
        }

        const resultBlob = await response.blob();
        return await this._blobToDataUrl(resultBlob);
    }

    async _callRemoveBgRemoveBackground(imageBlobOrDataUrl) {
        const apiKey = this.config.imageProcessing?.apiKey;
        if (!apiKey) throw new Error('未設定 Remove.bg API Key');

        let blob = imageBlobOrDataUrl;
        if (typeof imageBlobOrDataUrl === 'string' && imageBlobOrDataUrl.startsWith('data:')) {
            blob = await (await fetch(imageBlobOrDataUrl)).blob();
        }

        const formData = new FormData();
        formData.append('size', 'auto');
        formData.append('image_file', blob);

        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: { 'X-Api-Key': apiKey },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Remove.bg 去背失敗: ${response.status} ${errorText}`);
        }

        const resultBlob = await response.blob();
        return await this._blobToDataUrl(resultBlob);
    }

    async _callClipdropRemoveBackground(imageBlobOrDataUrl) {
        const apiKey = this.config.imageProcessing?.apiKey;
        if (!apiKey) throw new Error('未設定 Clipdrop API Key');

        // Convert DataURL to Blob if needed
        let blob = imageBlobOrDataUrl;
        if (typeof imageBlobOrDataUrl === 'string' && imageBlobOrDataUrl.startsWith('data:')) {
            blob = await (await fetch(imageBlobOrDataUrl)).blob();
        }

        const formData = new FormData();
        formData.append('image_file', blob);

        // Allow dev proxy bypass for CORS if env configured, otherwise direct
        const baseUrl = (import.meta.env && import.meta.env.DEV) ? '/api/clipdrop' : 'https://clipdrop-api.co';
        
        const response = await fetch(`${baseUrl}/remove-background/v1`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Clipdrop API Error:', errorText);
            throw new Error(`去背失敗: ${response.status} ${response.statusText}`);
        }

        const resultBlob = await response.blob();
        return await this._blobToDataUrl(resultBlob);
    }

    async _mockRemoveBackground() {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockTransparentImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACmSURBVGhD7c9BCsIwEEVRE+9/X+PChStxJwpeQ3Qk/QczlYF5sF0w8E0/I891XR+v1+v9/X6/eZ7neTwez3EcX5qm6Xmep3cEQRAEQRAEQRAEQRAEQRAEQRD+3b5t2/O6ruvLsixPz/M8/b9zHMen930/P3VdXxAEQRAEQRAEQRAEQRAEQRAEQfi3eJ7nq+d5nna73fNxHJ/Wdf3yff/h5xkEQfiB9x9XwQ6/nI2u6AAAAABJRU5ErkJggg==';
                resolve(mockTransparentImage);
            }, 1000);
        });
    }

    /**
     * 塗抹修補 (Inpainting)
     * @param {Blob|string} imageBlobOrDataUrl 原圖
     * @param {Blob|string} maskBlobOrDataUrl 遮罩
     * @returns {Promise<string>} 回傳結果的 Object URL 或 Data URL
     */
    async inpaint(imageBlobOrDataUrl, maskBlobOrDataUrl) {
        const provider = this.config.imageProcessing?.provider || 'clipdrop';
        
        if (provider === 'mock') {
            return this._mockInpaint();
        } else if (provider === 'clipdrop') {
            return this._callClipdropInpaint(imageBlobOrDataUrl, maskBlobOrDataUrl);
        } else if (provider === 'photoroom' || provider === 'removebg') {
            throw new Error(`您目前選擇的「${provider === 'photoroom' ? 'Photoroom API' : 'Remove.bg API'}」僅專精於影像去背。若要使用畫筆塗抹修補(Inpainting)功能，請至系統保險箱將影像處理服務切換為「Clipdrop API」。`);
        } else if (provider === 'sd') {
            throw new Error('Stable Diffusion 修補功能目前尚未實作，請選擇 Clipdrop 服務');
        } else {
            throw new Error(`不支援的影像修補 Provider: ${provider}`);
        }
    }

    async _callClipdropInpaint(image, mask) {
        const apiKey = this.config.imageProcessing?.apiKey;
        if (!apiKey) throw new Error('未設定 Clipdrop API Key');

        let imgBlob = image;
        if (typeof image === 'string' && image.startsWith('data:')) {
            imgBlob = await (await fetch(image)).blob();
        }

        let mskBlob = mask;
        if (typeof mask === 'string' && mask.startsWith('data:')) {
            mskBlob = await (await fetch(mask)).blob();
        }

        const formData = new FormData();
        formData.append('image_file', imgBlob);
        formData.append('mask_file', mskBlob);

        const baseUrl = (import.meta.env && import.meta.env.DEV) ? '/api/clipdrop' : 'https://clipdrop-api.co';

        const response = await fetch(`${baseUrl}/cleanup/v1`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Clipdrop API Error:', errorText);
            throw new Error(`修補失敗: ${response.status} ${response.statusText}`);
        }

        const resultBlob = await response.blob();
        return await this._blobToDataUrl(resultBlob);
    }

    /**
     * OCR 文字辨識
     * @param {Blob|string} imageBlobOrDataUrl 圖片 Blob 或 DataURL
     * @returns {Promise<string>} 辨識出的文字
     */
    async ocr(imageBlobOrDataUrl) {
        const activeLlmType = this.config.activeLlmType || 'builtin';
        const provider = this.config.builtin?.provider || 'gemini';
        
        let dataUrl = imageBlobOrDataUrl;
        if (typeof imageBlobOrDataUrl !== 'string' || !imageBlobOrDataUrl.startsWith('data:')) {
            // Convert Blob to DataURL
            dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageBlobOrDataUrl);
            });
        }

        const activeEp = this.config.customEndpoints?.find(e => e.id === this.config.activeCustomId);
        if (activeLlmType === 'custom' && activeEp?.baseUrl) {
            return this._callCustomOcr(dataUrl);
        } else if (provider === 'gemini') {
            return this._callGeminiOcr(dataUrl);
        } else if (provider === 'openai') {
            return this._callOpenAIOcr(dataUrl);
        } else if (provider === 'anthropic') {
            return this._callAnthropicOcr(dataUrl);
        } else if (provider === 'mock') {
            return this._mockOcr(dataUrl);
        } else {
            throw new Error(`不支援的 OCR Provider: ${provider}`);
        }
    }

    async _callCustomOcr(dataUrl) {
        const activeEp = this.config.customEndpoints?.find(e => e.id === this.config.activeCustomId);
        const { baseUrl, modelId, token } = activeEp || {};
        const apiUrl = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        const model = modelId || 'default-model';
        const prompt = "請辨識圖片中的文字。請「只」輸出辨識到的文字，不要加上任何其他說明、解釋或標籤符號。如果沒有文字請輸出空字串。";

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: dataUrl } }
                    ]
                }],
                max_tokens: 1024,
                temperature: 0.1
            })
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`自訂端點錯誤: ${res.status} ${res.statusText} - ${errText}`);
        }
        const result = await res.json();
        return result.choices?.[0]?.message?.content?.trim() || '';
    }

    async _callGeminiOcr(dataUrl) {
        const geminiKey = this.config.builtin?.geminiApiKey || this.config.builtin?.apiKey;
        if (!geminiKey) throw new Error('未設定 Google Gemini API Key');
        
        const candidateModels = Array.from(new Set([
            this.config.builtin?.model || 'gemini-1.5-flash-8b',
            'gemini-1.5-flash-8b',
            'gemini-2.5-flash',
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro'
        ]));
        
        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const prompt = "請辨識圖片中的文字。請「只」輸出辨識到的文字，不要加上任何其他說明、解釋或標籤符號。如果沒有文字請輸出空字串。";
        const requestPayload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Data } }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024
            }
        };

        let lastError = null;
        for (const m of candidateModels) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestPayload)
                });

                if (res.ok) {
                    const result = await res.json();
                    return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                } else {
                    const err = await res.json().catch(() => ({}));
                    lastError = new Error(`Gemini API 錯誤 (${m}): ${err.error?.message || res.statusText}`);
                }
            } catch (e) {
                lastError = e;
            }
        }
        
        if (lastError) throw lastError;
        return '';
    }

    async _callOpenAIOcr(dataUrl) {
        const openaiKey = this.config.builtin?.openaiApiKey || this.config.builtin?.apiKey;
        if (!openaiKey) throw new Error('未設定 OpenAI API Key');
        
        const openaiModel = this.config.builtin?.model || 'gpt-4o-mini';
        const prompt = "請辨識圖片中的文字。請「只」輸出辨識到的文字，不要加上任何其他說明、解釋或標籤符號。如果沒有文字請輸出空字串。";

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: openaiModel,
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: dataUrl } }
                    ]
                }],
                max_tokens: 1024,
                temperature: 0.1
            })
        });
        
        if (!res.ok) throw new Error(`OpenAI API 錯誤: ${res.status} ${res.statusText}`);
        const result = await res.json();
        return result.choices?.[0]?.message?.content?.trim() || '';
    }

    async _callAnthropicOcr(dataUrl) {
        const apiKey = this.config.builtin?.anthropicApiKey;
        if (!apiKey) throw new Error('未設定 Anthropic API Key');
        
        const model = this.config.builtin?.anthropicModel || this.config.builtin?.model || 'claude-3-5-sonnet-20241022';
        
        let mediaType = "image/jpeg";
        let base64Data = dataUrl;
        if (dataUrl.includes(',')) {
            const parts = dataUrl.split(',');
            const match = parts[0].match(/:(.*?);/);
            if (match) mediaType = match[1];
            base64Data = parts[1];
        }

        const prompt = "請辨識圖片中的文字。請「只」輸出辨識到的文字，不要加上任何其他說明、解釋或標籤符號。如果沒有文字請輸出空字串。";

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model,
                max_tokens: 1024,
                messages: [{
                    role: "user",
                    content: [
                        { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
                        { type: "text", text: prompt }
                    ]
                }]
            })
        });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Anthropic API 錯誤: ${res.status} ${res.statusText} - ${errText}`);
        }
        const result = await res.json();
        return result.content?.[0]?.text?.trim() || '';
    }

    async _mockOcr(dataUrl) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const words = ['設計', '排版', '開發', '創新', '畫布', '智能', '系統', '體驗', '模組', '測試'];
                const randomWord = () => words[Math.floor(Math.random() * words.length)];
                resolve(`${randomWord()}${randomWord()} ${randomWord()}`);
            }, 1000);
        });
    }
}
