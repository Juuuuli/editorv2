/**
 * SmartGuides.js
 * 畫布智慧參考線與磁吸對齊引擎 (Canva-style Precision Smart Guides & Alignment Engine)
 * 仿 Canva / Figma 專業排版體驗：
 * 1. 接近中心/邊界時自動吸附並繪製極細 1px 向量準線。
 * 2. 拖曳遠離中心/邊界時，參考線即刻 0ms 自動消失。
 * 3. 放開滑鼠時即刻 0ms 自動消失。
 */
import { fabric } from 'fabric';

export default class SmartGuides {
    constructor(canvasEngine, options = {}) {
        this.engine = canvasEngine;
        this.canvas = canvasEngine.canvas;
        this.eventBus = canvasEngine.eventBus;

        // Canva 風格吸附門檻 (螢幕像素)
        this.snapThreshold = options.snapThreshold || 10; 

        // Canva 經典配色：畫布基準線為精緻洋紅 (#e00070)，物件對齊為科技青藍 (#00c4cc)
        this.artboardGuideColor = options.artboardGuideColor || '#e00070';
        this.objectGuideColor = options.objectGuideColor || '#00c4cc';
        this.lineWidth = options.lineWidth || 1;

        this.enabled = localStorage.getItem('editor_smart_guides') !== 'false';
        
        // 當前活動輔助線資料 (X / Y)
        this.activeGuides = {
            vertical: null,   // { screenX, isArtboard, pYCenter }
            horizontal: null  // { screenY, isArtboard, pXCenter }
        };

        this.init();
    }

    init() {
        if (!this.canvas) return;

        // 1. 監聽物件移動：計算吸附並記錄參考線
        this.canvas.on('object:moving', (e) => {
            if (!this.enabled || !e.target) return;
            this.handleObjectMoving(e.target);
        });

        // 2. 在 Fabric 頂層 contextTop 直繪 1px 精確參考線
        this.canvas.on('after:render', () => {
            if (!this.enabled) return;
            this.renderDirectGuides();
        });

        // 3. 放開滑鼠、拖曳完成、選取改變或視窗釋放時「立即 0ms 清除」，保證零殘留
        this.canvas.on('object:modified', () => this.clearGuidelines());
        this.canvas.on('mouse:up', () => this.clearGuidelines());
        this.canvas.on('mouse:down', () => this.clearGuidelines());
        this.canvas.on('selection:cleared', () => this.clearGuidelines());
        this.canvas.on('selection:updated', () => this.clearGuidelines());
        this.canvas.on('selection:created', () => this.clearGuidelines());

        window.addEventListener('mouseup', () => this.clearGuidelines());
        window.addEventListener('pointerup', () => this.clearGuidelines());
        window.addEventListener('touchend', () => this.clearGuidelines());

        // 4. 監聽設定切換
        if (this.eventBus) {
            this.eventBus.on('SETTINGS:SMART_GUIDES_CHANGED', ({ enabled }) => {
                this.enabled = enabled;
                if (!enabled) {
                    this.clearGuidelines();
                }
            });
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) this.clearGuidelines();
    }

    /**
     * 立即清空參考線並重繪 (Canva 標準：0ms 殘留，立即清除 contextTop 像素)
     */
    clearGuidelines() {
        if (!this.activeGuides.vertical && !this.activeGuides.horizontal) return;
        this.activeGuides.vertical = null;
        this.activeGuides.horizontal = null;

        // 強制清除 Fabric 頂層 upper-canvas (contextTop) 上的輔助線像素
        const ctx = this.canvas.getSelectionContext ? this.canvas.getSelectionContext() : this.canvas.contextTop;
        if (ctx && this.canvas.width && this.canvas.height) {
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 重新繪製控制框 (此時不再繪製參考線)
        if (typeof this.canvas.renderTop === 'function') {
            this.canvas.renderTop();
        } else {
            this.canvas.requestRenderAll();
        }
    }

    /**
     * 計算物件統一邊界 (標準化 originX / originY)
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
     * 套用吸附後的座標 (自動適配 originX / originY)
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
     * 拖曳運算：精準判定對齊並更新參考線，遠離時自動清除參考線
     */
    handleObjectMoving(target) {
        const artboard = this.engine.artboard;
        if (!artboard || target === artboard || target.isSmartGuide || target.isRegionBox || target.isSmartToolOverlay) return;

        target.setCoords();
        const t = this.getObjectBounds(target);
        const zoom = this.canvas.getZoom() || 1;
        const vpt = this.canvas.viewportTransform;
        const threshold = this.snapThreshold / zoom;

        const artboardWidth = artboard.width || 1280;
        const artboardHeight = artboard.height || 720;

        // 1. 收集畫布基準對齊目標
        const snapTargetsX = [
            { val: 0, guide: 0, isArtboard: true },
            { val: artboardWidth / 2, guide: artboardWidth / 2, isArtboard: true },
            { val: artboardWidth, guide: artboardWidth, isArtboard: true }
        ];

        const snapTargetsY = [
            { val: 0, guide: 0, isArtboard: true },
            { val: artboardHeight / 2, guide: artboardHeight / 2, isArtboard: true },
            { val: artboardHeight, guide: artboardHeight, isArtboard: true }
        ];

        // 2. 收集其他可見圖元對齊目標
        const objects = this.canvas.getObjects();
        for (const obj of objects) {
            if (obj === target || obj === artboard || obj.isSmartGuide || obj.isRegionBox || obj.isSmartToolOverlay || obj.excludeFromExport) continue;
            if (!obj.visible || obj.opacity === 0) continue;

            const o = this.getObjectBounds(obj);

            snapTargetsX.push(
                { val: o.left, guide: o.left, isArtboard: false },
                { val: o.centerX, guide: o.centerX, isArtboard: false },
                { val: o.right, guide: o.right, isArtboard: false }
            );

            snapTargetsY.push(
                { val: o.top, guide: o.top, isArtboard: false },
                { val: o.centerY, guide: o.centerY, isArtboard: false },
                { val: o.bottom, guide: o.bottom, isArtboard: false }
            );
        }

        // --- X 軸吸附判定 ---
        let snappedLeft = null;
        let matchedX = null;

        for (const s of snapTargetsX) {
            if (Math.abs(t.left - s.val) < threshold) {
                snappedLeft = s.val;
                matchedX = s;
                break;
            }
            if (Math.abs(t.centerX - s.val) < threshold) {
                snappedLeft = s.val - t.width / 2;
                matchedX = s;
                break;
            }
            if (Math.abs(t.right - s.val) < threshold) {
                snappedLeft = s.val - t.width;
                matchedX = s;
                break;
            }
        }

        // --- Y 軸吸附判定 ---
        let snappedTop = null;
        let matchedY = null;

        for (const s of snapTargetsY) {
            if (Math.abs(t.top - s.val) < threshold) {
                snappedTop = s.val;
                matchedY = s;
                break;
            }
            if (Math.abs(t.centerY - s.val) < threshold) {
                snappedTop = s.val - t.height / 2;
                matchedY = s;
                break;
            }
            if (Math.abs(t.bottom - s.val) < threshold) {
                snappedTop = s.val - t.height;
                matchedY = s;
                break;
            }
        }

        // 套用吸附位置
        if (snappedLeft !== null || snappedTop !== null) {
            this.setObjectPosition(target, snappedLeft, snappedTop);
            target.setCoords();
        }

        // 更新活動參考線狀態 (若無對齊則為 null)
        this.activeGuides.vertical = matchedX ? {
            screenX: Math.round(fabric.util.transformPoint(new fabric.Point(matchedX.guide, 0), vpt).x) + 0.5,
            isArtboard: matchedX.isArtboard,
            pYCenter: Math.round(fabric.util.transformPoint(new fabric.Point(matchedX.guide, artboardHeight / 2), vpt).y)
        } : null;

        this.activeGuides.horizontal = matchedY ? {
            screenY: Math.round(fabric.util.transformPoint(new fabric.Point(0, matchedY.guide), vpt).y) + 0.5,
            isArtboard: matchedY.isArtboard,
            pXCenter: Math.round(fabric.util.transformPoint(new fabric.Point(artboardWidth / 2, matchedY.guide), vpt).x)
        } : null;

        // 清除上一幀的 contextTop 並觸發重繪 (若已遠離對齊線，則線條立即抹除)
        const ctx = this.canvas.getSelectionContext ? this.canvas.getSelectionContext() : this.canvas.contextTop;
        if (ctx && this.canvas.width && this.canvas.height) {
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (typeof this.canvas.renderTop === 'function') {
            this.canvas.renderTop();
        } else {
            this.canvas.requestRenderAll();
        }
    }

    /**
     * Canva 風格直繪：極細 1px 俐落向量線條與精緻定位錨點
     */
    renderDirectGuides() {
        const ctx = this.canvas.getSelectionContext ? this.canvas.getSelectionContext() : this.canvas.contextTop;
        if (!ctx) return;

        const v = this.activeGuides.vertical;
        const h = this.activeGuides.horizontal;

        // 若無活動輔助線，不繪製任何線條
        if (!v && !h) return;

        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        ctx.save();
        ctx.setLineDash([]); // 實線 (Canva 標準)

        // 垂直參考線 (X 軸)
        if (v) {
            const color = v.isArtboard ? this.artboardGuideColor : this.objectGuideColor;

            ctx.beginPath();
            ctx.moveTo(v.screenX, 0);
            ctx.lineTo(v.screenX, canvasHeight);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 中心微型錨點 (小巧精緻)
            ctx.beginPath();
            ctx.arc(v.screenX, v.pYCenter, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // 水平參考線 (Y 軸)
        if (h) {
            const color = h.isArtboard ? this.artboardGuideColor : this.objectGuideColor;

            ctx.beginPath();
            ctx.moveTo(0, h.screenY);
            ctx.lineTo(canvasWidth, h.screenY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke();

            // 中心微型錨點
            ctx.beginPath();
            ctx.arc(h.pXCenter, h.screenY, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();
    }
}
