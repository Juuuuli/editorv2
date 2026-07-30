export default class RatioManager {
    constructor(canvasEngine, eventBus) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;
        
        // UI Elements
        this.groupImage = document.getElementById('group-ratio-image');
        this.groupPdf = document.getElementById('group-ratio-pdf');
        
        this.btn169 = document.getElementById('btn-ratio-16-9');
        this.btn43 = document.getElementById('btn-ratio-4-3');
        this.btnLandscape = document.getElementById('btn-ratio-landscape');
        this.btnPortrait = document.getElementById('btn-ratio-portrait');
        
        this.isLocked = false;
        
        // Define sizes
        this.sizes = {
            '16:9': { width: 1920, height: 1080 },
            '4:3': { width: 1440, height: 1080 },
            'landscape': { width: 1123, height: 794 }, // A4 landscape at 96 DPI
            'portrait': { width: 794, height: 1123 }   // A4 portrait at 96 DPI
        };

        this.bindEvents();
        
        // Initialize with default ratio
        this.setRatio('16:9', this.btn169, this.groupImage);
    }

    bindEvents() {
        // Workspace switch handling
        this.eventBus.on('WORKSPACE:MODE_CHANGED', (data) => {
            this.unlock(); // 切換工作區視同開新專案，解除鎖定
            
            if (data.mode === 'IMAGE' || data.mode === 'IDLE') {
                if (this.groupImage) this.groupImage.style.display = 'flex';
                if (this.groupPdf) this.groupPdf.style.display = 'none';
                if (!this.isLocked && this.btn169) {
                    this.setRatio('16:9', this.btn169, this.groupImage);
                }
            } else if (data.mode === 'PDF') {
                if (this.groupImage) this.groupImage.style.display = 'flex';
                if (this.groupPdf) this.groupPdf.style.display = 'flex';
                if (!this.isLocked && this.btnPortrait) {
                    this.setRatio('portrait', this.btnPortrait, this.groupPdf);
                }
            }
        });

        // Button clicks
        if (this.btn169) {
            this.btn169.addEventListener('click', () => {
                if (this.isLocked) return;
                this.setRatio('16:9', this.btn169, this.groupImage);
            });
        }

        if (this.btn43) {
            this.btn43.addEventListener('click', () => {
                if (this.isLocked) return;
                this.setRatio('4:3', this.btn43, this.groupImage);
            });
        }

        if (this.btnLandscape) {
            this.btnLandscape.addEventListener('click', () => {
                if (this.isLocked) return;
                this.setRatio('landscape', this.btnLandscape, this.groupPdf);
            });
        }

        if (this.btnPortrait) {
            this.btnPortrait.addEventListener('click', () => {
                if (this.isLocked) return;
                this.setRatio('portrait', this.btnPortrait, this.groupPdf);
            });
        }

        // Lock when file is imported
        this.eventBus.on('FILE:IMPORTED', () => {
            this.lock();
        });
        
        // Lock when PDF/Project is imported
        this.eventBus.on('PROJECT:IMPORTED', () => {
            this.lock();
        });
    }

    setRatio(type, activeBtn, group) {
        if (this.isLocked) return;

        // Reset active styles in all groups
        [this.groupImage, this.groupPdf].forEach(g => {
            if (!g) return;
            const buttons = g.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.classList.remove('text-indigo-700', 'active-ratio');
                btn.classList.add('text-slate-500');
            });
        });

        // Set active style
        activeBtn.classList.remove('text-slate-500');
        activeBtn.classList.add('text-indigo-700', 'active-ratio');

        // Apply to Canvas
        const size = this.sizes[type];
        if (size && this.canvasEngine) {
            this.canvasEngine.resizeArtboard(size.width, size.height);
            this.canvasEngine.fitToScreen();
            
            // To prevent undoing to an empty canvas with wrong size, we might want to save history
            this.canvasEngine.saveHistory();
        }
    }

    lock() {
        this.isLocked = true;
        [this.btn169, this.btn43, this.btnLandscape, this.btnPortrait].forEach(btn => {
            if (btn) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
    }

    unlock() {
        this.isLocked = false;
        [this.btn169, this.btn43, this.btnLandscape, this.btnPortrait].forEach(btn => {
            if (btn) {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
    }
}
