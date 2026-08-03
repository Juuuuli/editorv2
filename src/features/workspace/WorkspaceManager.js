export const WorkspaceMode = {
    IDLE: 'IDLE',
    IMAGE: 'IMAGE',
    PDF: 'PDF'
};

export default class WorkspaceManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentMode = WorkspaceMode.IDLE;
        this.isDirty = false;
        
        this.bindEvents();
        
        // 初始化時自動切換至預設的 PDF 工作區，確保所有相關元件 (如比例按鈕) 狀態同步
        setTimeout(() => {
            this.switchMode(WorkspaceMode.PDF);
        }, 0);
    }

    bindEvents() {
        const imageTab = document.getElementById('tab-image-workspace');
        const pdfTab = document.getElementById('tab-pdf-workspace');

        if(imageTab) {
            imageTab.addEventListener('click', () => this.switchMode(WorkspaceMode.IMAGE));
        }
        if(pdfTab) {
            pdfTab.addEventListener('click', () => this.switchMode(WorkspaceMode.PDF));
        }

        // 接收來自 CanvasEngine 的髒標記更新
        this.eventBus.on('CANVAS:DIRTY', (isDirty) => {
            this.setDirty(isDirty);
        });
    }

    switchMode(newMode, force = false) {
        if (this.currentMode === newMode) return;
        
        if (!force && this.isDirty) {
            const confirmSwitch = window.confirm("目前畫布有未儲存的變更，切換工作區將清除畫布，是否繼續？");
            if (!confirmSwitch) return;
        }

        this.currentMode = newMode;
        this.isDirty = false;
        console.log(`切換至工作區: ${newMode}`);
        
        this.updateUI(newMode);
        
        // 廣播工作區切換事件，UI 與 Canvas 會根據此事件重置與顯示隱藏
        this.eventBus.emit('WORKSPACE:MODE_CHANGED', { mode: newMode });
    }

    updateUI(mode) {
        const imageTab = document.getElementById('tab-image-workspace');
        const pdfTab = document.getElementById('tab-pdf-workspace');
        if(!imageTab || !pdfTab) return;

        const activeClasses = ['bg-indigo-50', 'text-indigo-700'];
        const inactiveClasses = ['hover:bg-slate-100', 'text-slate-600'];

        if (mode === WorkspaceMode.IMAGE) {
            imageTab.classList.remove(...inactiveClasses);
            imageTab.classList.add(...activeClasses);
            pdfTab.classList.remove(...activeClasses);
            pdfTab.classList.add(...inactiveClasses);
        } else if (mode === WorkspaceMode.PDF) {
            pdfTab.classList.remove(...inactiveClasses);
            pdfTab.classList.add(...activeClasses);
            imageTab.classList.remove(...activeClasses);
            imageTab.classList.add(...inactiveClasses);
        }
    }

    setDirty(dirty) {
        this.isDirty = dirty;
    }
}
