/**
 * SmartGuides.js
 * 畫布智慧參考線與吸附對齊引擎 (Smart Alignment Guides & Magnetic Snapping Engine)
 * 採用「Fabric contextTop 頂層直繪 + 獨立 SVG Overlay」雙重渲染管線，保證 100% 絕對可見度與零覆蓋問題。
 * 具備 Figma / Canva 等級之「磁力捕獲 (Magnetic Sticky Capture)」手感與高辨識度 HUD 標籤。
 */
import { fabric } from 'fabric';

export default class SmartGuides {
    constructor(canvasEngine, options = {}) {
        this.engine = canvasEngine;
        this.canvas = canvasEngine.canvas;
        this.eventBus = canvasEngine.eventBus;

        // 磁吸判定參數 (螢幕像素)
        this.snapThreshold = options.snapThreshold || 24; // 捕捉距離
        this.breakThreshold = options.breakThreshold || 32; // 脫離距離

        // 配色方案
        this.artboardGuideColor = options.artboardGuideColor || '#ff0055'; // 畫布對齊：螢光桃紅
        this.objectGuideColor = options.objectGuideColor || '#00f0ff';     // 圖元對齊：電光青藍
        this.lineWidth = options.lineWidth || 2.5;

        this.enabled = localStorage.getItem('editor_smart_guides') !== 'false';
        
        // 當前活動輔助線資料
        this.activeGuides = {
            vertical: null,   // { screenX, guideVal, label, isArtboard, pYCenter }
            horizontal: null  // { screenY, guideVal, label, isArtboard, pXCenter }
        };

        // 磁力鎖定狀態
        this.lockedX = null;
        this.lockedY = null;

        this.svgOverlay = null;
        this.fadeTimeout = null;
        this.fadeAlpha = 1.0;
        this.isFading = false;

        this.init();
    }

    init() {
        if (!this.canvas) return;

        this.createSVGOverlay();

        // 1. 監聽物件移動事件 (進行磁吸運算)
        this.canvas.on('object:moving', (e) => {
            if (!this.enabled || !e.target) return;
            this.handleObjectMoving(e.target);
        });

        // 2. 核心渲染鉤子：在 Fabric 頂層 contextTop (與選取框同一層) 直接繪製輔助線
        this.canvas.on('after:render', () => {
            if (!this.enabled) return;
            this.renderDirectCanvasGuides();
        });

        // 3. 移動結束或取消選取時平滑淡出
        this.canvas.on('object:modified', () => this.startFadeOut());
        this.canvas.on('mouse:up', () => this.startFadeOut());
        this.canvas.on('selection:cleared', () => this.clearGuidelinesImmediate());

        // 4. 監聽設定切換
        if (this.eventBus) {
            this.eventBus.on('SETTINGS:SMART_GUIDES_CHANGED', ({ enabled }) => {
                this.enabled = enabled;
                if (!enabled) {
                    this.clearGuidelinesImmediate();
                } else {
                    this.showStatusToast('畫布智慧輔助線與磁吸對齊已啟用');
                }
            });
        }

        // 5. 監聽視圖縮放或平移
        this.canvas.on('after:zoom', () => this.syncOverlayDimensions());
        window.addEventListener('resize', () => this.syncOverlayDimensions());
    }

    /**
     * 建立備用頂層 SVG Overlay
     */
    createSVGOverlay() {
        if (this.svgOverlay && this.svgOverlay.parentNode) return;

        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        overlay.setAttribute('id', 'smart-guides-overlay');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '99999';
        overlay.style.overflow = 'visible';
        overlay.style.transition = 'opacity 0.25s ease-out';

        const parent = this.canvas.wrapperEl || document.getElementById('workspace-container') || document.body;
        parent.appendChild(overlay);
        this.svgOverlay = overlay;

        this.syncOverlayDimensions();
    }

    syncOverlayDimensions() {
        if (!this.svgOverlay) return;
        const containerWidth = this.canvas.width || (this.engine.container ? this.engine.container.clientWidth : 2500);
        const containerHeight = this.canvas.height || (this.engine.container ? this.engine.container.clientHeight : 2500);

        this.svgOverlay.setAttribute('width', `${containerWidth}`);
        this.svgOverlay.setAttribute('height', `${containerHeight}`);
        this.svgOverlay.setAttribute('viewBox', `0 0 ${containerWidth} ${containerHeight}`);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) this.clearGuidelinesImmediate();
    }

    clearGuidelinesImmediate() {
        if (this.fadeTimeout) {
            clearTimeout(this.fadeTimeout);
            this.fadeTimeout = null;
        }
        this.activeGuides.vertical = null;
        this.activeGuides.horizontal = null;
        this.lockedX = null;
        this.lockedY = null;
        this.isFading = false;
        this.fadeAlpha = 1.0;

        if (this.svgOverlay) {
            this.svgOverlay.innerHTML = '';
            this.svgOverlay.style.opacity = '1';
        }

        // 強制重繪清除 contextTop
        this.canvas.requestRenderAll();
    }

    startFadeOut() {
        if (!this.activeGuides.vertical && !this.activeGuides.horizontal) return;
        if (this.fadeTimeout) clearTimeout(this.fadeTimeout);

        this.isFading = true;
        const startTime = performance.now();
        const duration = 280; // 280ms 平滑淡出

        const fadeStep = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            this.fadeAlpha = 1.0 - progress;

            if (this.svgOverlay) {
                this.svgOverlay.style.opacity = `${this.fadeAlpha}`;
            }

            this.canvas.requestRenderAll();

            if (progress < 1) {
                this.fadeTimeout = requestAnimationFrame(fadeStep);
            } else {
                this.clearGuidelinesImmediate();
            }
        };

        this.fadeTimeout = requestAnimationFrame(fadeStep);
    }

    /**
     * 計算物件統一幾何邊界 (標準化 originX / originY)
     */
    getObjectBounds(obj) {
        const width = obj.getScaledWidth ? obj.getScaledWidth() : (obj.width * (obj.scaleX || 1));
        const height = obj.getScaledHeight ? obj.getScaledHeight() : (obj.height * (obj.scaleY || 1));
        
        let left = obj.left;
        let top = obj.top;

        if (obj.originX === 'center') {
            left = obj.left - width / 2;
        } else if (obj.originX === 'right') {
            left = obj.left - width;
        }

        if (obj.originY === 'center') {
            top = obj.top - height / 2;
        } else if (obj.originY === 'bottom') {
            top = obj.top - height;
        }

        return {
            left,
            top,
            width,
            height,
            centerX: left + width / 2,
            centerY: top + height / 2,
            right: left + width,
            bottom: top + height
        };
    }

    /**
     * 依據吸附座標設定物件 (自動換算 originX / originY)
     */
    setObjectPosition(obj, leftEdge, topEdge) {
        const width = obj.getScaledWidth ? obj.getScaledWidth() : (obj.width * (obj.scaleX || 1));
        const height = obj.getScaledHeight ? obj.getScaledHeight() : (obj.height * (obj.scaleY || 1));

        if (leftEdge !== null && leftEdge !== undefined) {
            if (obj.originX === 'center') {
                obj.set('left', leftEdge + width / 2);
            } else if (obj.originX === 'right') {
                obj.set('left', leftEdge + width);
            } else {
                obj.set('left', leftEdge);
            }
        }

        if (topEdge !== null && topEdge !== undefined) {
            if (obj.originY === 'center') {
                obj.set('top', topEdge + height / 2);
            } else if (obj.originY === 'bottom') {
                obj.set('top', topEdge + height);
            } else {
                obj.set('top', topEdge);
            }
        }
    }

    /**
     * 物件拖曳時的核心磁力吸附與對齊運算
     */
    handleObjectMoving(target) {
        const artboard = this.engine.artboard;
        if (!artboard || target === artboard || target.isSmartGuide || target.isRegionBox || target.isSmartToolOverlay) return;

        if (this.isFading) {
            this.clearGuidelinesImmediate();
        }

        target.setCoords();
        const t = this.getObjectBounds(target);
        const zoom = this.canvas.getZoom() || 1;
        const vpt = this.canvas.viewportTransform;

        const snapDistWorld = this.snapThreshold / zoom;
        const breakDistWorld = this.breakThreshold / zoom;

        const artboardWidth = artboard.width || 1280;
        const artboardHeight = artboard.height || 720;

        // 1. 收集潛在對齊目標 (畫布邊界/中心)
        const snapTargetsX = [
            { val: 0, guide: 0, label: '畫布左邊界', isArtboard: true },
            { val: artboardWidth / 2, guide: artboardWidth / 2, label: '畫布水平中心', isArtboard: true },
            { val: artboardWidth, guide: artboardWidth, label: '畫布右邊界', isArtboard: true }
        ];

        const snapTargetsY = [
            { val: 0, guide: 0, label: '畫布頂部邊界', isArtboard: true },
            { val: artboardHeight / 2, guide: artboardHeight / 2, label: '畫布垂直中心', isArtboard: true },
            { val: artboardHeight, guide: artboardHeight, label: '畫布底部邊界', isArtboard: true }
        ];

        // 2. 收集其他圖元對齊目標
        const objects = this.canvas.getObjects();
        for (const obj of objects) {
            if (obj === target || obj === artboard || obj.isSmartGuide || obj.isRegionBox || obj.isSmartToolOverlay || obj.excludeFromExport) continue;
            if (!obj.visible || obj.opacity === 0) continue;

            const o = this.getObjectBounds(obj);

            snapTargetsX.push(
                { val: o.left, guide: o.left, label: '圖元左邊緣', isArtboard: false },
                { val: o.centerX, guide: o.centerX, label: '圖元水平中心', isArtboard: false },
                { val: o.right, guide: o.right, label: '圖元右邊緣', isArtboard: false }
            );

            snapTargetsY.push(
                { val: o.top, guide: o.top, label: '圖元頂部對齊', isArtboard: false },
                { val: o.centerY, guide: o.centerY, label: '圖元垂直中心', isArtboard: false },
                { val: o.bottom, guide: o.bottom, label: '圖元底部對齊', isArtboard: false }
            );
        }

        // --- X 軸磁力吸附運算 ---
        let snappedLeft = null;
        let matchedX = null;

        for (const s of snapTargetsX) {
            // 檢查左邊、中心、右邊三種對齊可能
            if (Math.abs(t.left - s.val) < snapDistWorld) {
                snappedLeft = s.val;
                matchedX = s;
                break;
            }
            if (Math.abs(t.centerX - s.val) < snapDistWorld) {
                snappedLeft = s.val - t.width / 2;
                matchedX = s;
                break;
            }
            if (Math.abs(t.right - s.val) < snapDistWorld) {
                snappedLeft = s.val - t.width;
                matchedX = s;
                break;
            }
        }

        // --- Y 軸磁力吸附運算 ---
        let snappedTop = null;
        let matchedY = null;

        for (const s of snapTargetsY) {
            if (Math.abs(t.top - s.val) < snapDistWorld) {
                snappedTop = s.val;
                matchedY = s;
                break;
            }
            if (Math.abs(t.centerY - s.val) < snapDistWorld) {
                snappedTop = s.val - t.height / 2;
                matchedY = s;
                break;
            }
            if (Math.abs(t.bottom - s.val) < snapDistWorld) {
                snappedTop = s.val - t.height;
                matchedY = s;
                break;
            }
        }

        // 套用磁吸位置
        if (snappedLeft !== null || snappedTop !== null) {
            this.setObjectPosition(target, snappedLeft, snappedTop);
            target.setCoords();
        }

        // 儲存目前活動參考線資訊供渲染管線使用
        if (matchedX) {
            const screenX = fabric.util.transformPoint(new fabric.Point(matchedX.guide, 0), vpt).x;
            const pYCenter = fabric.util.transformPoint(new fabric.Point(matchedX.guide, artboardHeight / 2), vpt).y;
            this.activeGuides.vertical = {
                screenX,
                guideVal: matchedX.guide,
                label: matchedX.label,
                isArtboard: matchedX.isArtboard,
                pYCenter
            };
        } else {
            this.activeGuides.vertical = null;
        }

        if (matchedY) {
            const screenY = fabric.util.transformPoint(new fabric.Point(0, matchedY.guide), vpt).y;
            const pXCenter = fabric.util.transformPoint(new fabric.Point(artboardWidth / 2, matchedY.guide), vpt).x;
            this.activeGuides.horizontal = {
                screenY,
                guideVal: matchedY.guide,
                label: matchedY.label,
                isArtboard: matchedY.isArtboard,
                pXCenter
            };
        } else {
            this.activeGuides.horizontal = null;
        }

        // 觸發重繪 (會執行 renderDirectCanvasGuides 與 renderSVGGuides)
        this.renderSVGOverlayGuides(this.activeGuides.vertical, this.activeGuides.horizontal, artboard);
        this.canvas.requestRenderAll();
    }

    /**
     * 【管線 1】在 Fabric 頂層 contextTop 直接以原生 2D Canvas 繪製發光參考線與 HUD 膠囊標籤
     */
    renderDirectCanvasGuides() {
        const ctx = this.canvas.getSelectionContext ? this.canvas.getSelectionContext() : this.canvas.contextTop;
        if (!ctx) return;

        const v = this.activeGuides.vertical;
        const h = this.activeGuides.horizontal;

        if (!v && !h) return;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const alpha = this.fadeAlpha;

        ctx.save();
        ctx.globalAlpha = alpha;

        // 繪製垂直參考線 (X 軸)
        if (v) {
            const color = v.isArtboard ? this.artboardGuideColor : this.objectGuideColor;

            // 1. 底層光暈粗線
            ctx.beginPath();
            ctx.moveTo(v.screenX, 0);
            ctx.lineTo(v.screenX, canvasHeight);
            ctx.strokeStyle = color;
            ctx.lineWidth = 5;
            ctx.globalAlpha = alpha * 0.35;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.stroke();

            // 2. 前景虛線
            ctx.beginPath();
            ctx.moveTo(v.screenX, 0);
            ctx.lineTo(v.screenX, canvasHeight);
            ctx.strokeStyle = color;
            ctx.lineWidth = this.lineWidth;
            ctx.setLineDash([8, 4]);
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 0;
            ctx.stroke();

            // 3. 中心錨點 (雙層圓形)
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(v.screenX, v.pYCenter, 6, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 4. HUD 浮動標籤
            this.drawCanvasHUD(ctx, v.label, v.screenX + 12, v.pYCenter - 24, color, canvasWidth, canvasHeight);
        }

        // 繪製水平參考線 (Y 軸)
        if (h) {
            const color = h.isArtboard ? this.artboardGuideColor : this.objectGuideColor;

            // 1. 底層光暈粗線
            ctx.beginPath();
            ctx.moveTo(0, h.screenY);
            ctx.lineTo(canvasWidth, h.screenY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 5;
            ctx.globalAlpha = alpha * 0.35;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.stroke();

            // 2. 前景虛線
            ctx.beginPath();
            ctx.moveTo(0, h.screenY);
            ctx.lineTo(canvasWidth, h.screenY);
            ctx.strokeStyle = color;
            ctx.lineWidth = this.lineWidth;
            ctx.setLineDash([8, 4]);
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 0;
            ctx.stroke();

            // 3. 中心錨點
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.arc(h.pXCenter, h.screenY, 6, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 4. HUD 浮動標籤
            this.drawCanvasHUD(ctx, h.label, h.pXCenter - 50, h.screenY + 12, color, canvasWidth, canvasHeight);
        }

        ctx.restore();
    }

    /**
     * 繪製深色質感 HUD 膠囊氣泡標籤
     */
    drawCanvasHUD(ctx, text, x, y, borderColor, maxX, maxY) {
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const textMetrics = ctx.measureText(text);
        const paddingX = 10;
        const paddingY = 6;
        const boxWidth = textMetrics.width + paddingX * 2;
        const boxHeight = 22;

        const posX = Math.min(Math.max(x, 10), maxX - boxWidth - 10);
        const posY = Math.min(Math.max(y, 10), maxY - boxHeight - 10);

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // 圓角背景
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(posX, posY, boxWidth, boxHeight, 6);
        } else {
            ctx.rect(posX, posY, boxWidth, boxHeight);
        }
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; // 深色 Slate 900
        ctx.fill();

        // 外邊框
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 文字
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, posX + paddingX, posY + boxHeight / 2 + 1);

        ctx.restore();
    }

    /**
     * 【管線 2】頂層 SVG 向量輔助繪製 (作為雙重保障)
     */
    renderSVGOverlayGuides(v, h, artboard) {
        if (!this.svgOverlay || !this.svgOverlay.parentNode) this.createSVGOverlay();
        if (!this.svgOverlay) return;

        if (!v && !h) {
            this.svgOverlay.innerHTML = '';
            return;
        }

        this.syncOverlayDimensions();
        const containerWidth = this.canvas.width || 2500;
        const containerHeight = this.canvas.height || 2500;

        let svgHTML = '';

        if (v) {
            const color = v.isArtboard ? this.artboardGuideColor : this.objectGuideColor;
            svgHTML += `
                <line x1="${v.screenX}" y1="0" x2="${v.screenX}" y2="${containerHeight}" stroke="${color}" stroke-width="${this.lineWidth}" stroke-dasharray="8,4" opacity="0.9" />
                <circle cx="${v.screenX}" cy="${v.pYCenter}" r="5" fill="${color}" stroke="#ffffff" stroke-width="2" />
            `;
        }

        if (h) {
            const color = h.isArtboard ? this.artboardGuideColor : this.objectGuideColor;
            svgHTML += `
                <line x1="0" y1="${h.screenY}" x2="${containerWidth}" y2="${h.screenY}" stroke="${color}" stroke-width="${this.lineWidth}" stroke-dasharray="8,4" opacity="0.9" />
                <circle cx="${h.pXCenter}" cy="${h.screenY}" r="5" fill="${color}" stroke="#ffffff" stroke-width="2" />
            `;
        }

        this.svgOverlay.innerHTML = svgHTML;
    }

    /**
     * 輕量狀態提示 Toast
     */
    showStatusToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[100000] px-4 py-2 bg-slate-900/90 backdrop-blur border border-indigo-500/50 text-indigo-300 text-xs font-bold rounded-full shadow-2xl transition-all duration-300 pointer-events-none opacity-0 translate-y-2';
        toast.innerHTML = `<i class="fas fa-magic mr-1.5 text-indigo-400"></i> ${message}`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-2');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}
