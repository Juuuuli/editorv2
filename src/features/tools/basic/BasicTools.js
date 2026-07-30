export default class BasicTools {
    constructor(canvasEngine, eventBus) {
        this.canvasEngine = canvasEngine;
        this.eventBus = eventBus;
        
        this.bindEvents();
    }

    bindEvents() {
        const btnSelect = document.getElementById('btn-tool-select');
        const btnPan = document.getElementById('btn-tool-pan');
        const btnBrush = document.getElementById('btn-tool-brush');
        const btnShape = document.getElementById('btn-tool-shape');
        const btnZoomIn = document.getElementById('btn-tool-zoom-in');
        const btnZoomOut = document.getElementById('btn-tool-zoom-out');

        if(btnSelect) btnSelect.addEventListener('click', () => this.setMode('selection'));
        if(btnPan) btnPan.addEventListener('click', () => this.setMode('panning'));
        if(btnBrush) btnBrush.addEventListener('click', () => this.setMode('drawing'));
        
        if(btnShape) btnShape.addEventListener('click', () => {
            this.addRandomShape();
        });
        if(btnZoomIn) btnZoomIn.addEventListener('click', () => {
            this.canvasEngine.zoomIn();
        });
        if(btnZoomOut) btnZoomOut.addEventListener('click', () => {
            this.canvasEngine.zoomOut();
        });
    }

    setMode(mode) {
        const canvas = this.canvasEngine.canvas;
        
        // 狀態互斥防呆：清除舊狀態
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        
        // 設定新狀態
        switch (mode) {
            case 'drawing':
                canvas.isDrawingMode = true;
                canvas.freeDrawingBrush.color = '#334155';
                canvas.freeDrawingBrush.width = 5;
                this.canvasEngine.setMode('drawing');
                console.log('切換為畫筆模式');
                break;
            case 'panning':
                canvas.selection = false;
                canvas.defaultCursor = 'grab';
                this.canvasEngine.setMode('panning');
                console.log('切換為平移模式');
                break;
            case 'selection':
            default:
                canvas.selection = true; // 啟用原生的紅色選取框
                canvas.defaultCursor = 'default';
                this.canvasEngine.setMode('selection');
                console.log('切換為選取模式');
                break;
        }
        
        this.updateUI(mode);
        this.eventBus.emit('UI:TOOL_CHANGED', { tool: mode });
    }

    updateUI(mode) {
        const btnSelect = document.getElementById('btn-tool-select');
        const btnPan = document.getElementById('btn-tool-pan');
        const btnBrush = document.getElementById('btn-tool-brush');
        if(!btnSelect || !btnPan || !btnBrush) return;

        const allBtns = [btnSelect, btnPan, btnBrush];
        const activeClasses = ['bg-indigo-50', 'text-indigo-700'];
        const inactiveClasses = ['text-slate-500', 'hover:bg-slate-100'];

        // 先重置全部
        allBtns.forEach(btn => {
            btn.classList.remove(...activeClasses);
            btn.classList.add(...inactiveClasses);
        });

        // 再點亮目標
        let targetBtn = btnSelect;
        if (mode === 'panning') targetBtn = btnPan;
        if (mode === 'drawing') targetBtn = btnBrush;

        targetBtn.classList.remove(...inactiveClasses);
        targetBtn.classList.add(...activeClasses);
    }

    addRandomShape() {
        const canvas = this.canvasEngine.canvas;
        const rect = new fabric.Rect({
            left: this.canvasEngine.artboard ? this.canvasEngine.artboard.left + 50 : 50,
            top: this.canvasEngine.artboard ? this.canvasEngine.artboard.top + 50 : 50,
            fill: '#indigo-500', // 會在 applyCustomStyles 處理手繪感，這裡隨便給顏色
            width: 100,
            height: 100,
            stroke: '#334155',
            strokeWidth: 2,
            rx: 10,
            ry: 10
        });
        canvas.add(rect);
        canvas.setActiveObject(rect);
        this.setMode('selection'); // 新增後自動跳回選取模式
    }
}
