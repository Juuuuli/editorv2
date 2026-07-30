import { fabric } from 'fabric';

// Simple deterministic random generator for handdrawn effects
const seededRandom = (seed) => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

export const buildTableGroup = (options) => {
    const { 
        rows, cols, data, hasHeader, isHanddrawn,
        tableBgColor = '#ffffff',
        headerBgColor = '#334155',
        tableBorderColor = '#cbd5e1',
        tableFontSize = 16,
        tableTextColor = '#334155',
        headerTextColor = '#ffffff',
        tableTemplate = 'default',
        tableStripeColor,
        tableTextAlign = 'left',
        tableVerticalAlign = 'top',
        tableFontFamily = 'Noto Sans TC',
        borderTop = true,
        borderBottom = true,
        borderLeft = true,
        borderRight = true,
        borderInnerH = true,
        borderInnerV = true,
        tableBorderWidth = 1.5
    } = options;
    
    // Dynamic sizes or fallback to cellW/cellH
    const baseW = options.cellW || 150;
    const baseH = options.cellH || 50;
    const colWidths = [...(options.colWidths || Array(cols).fill(baseW))];
    const rowHeights = [...(options.rowHeights || Array(rows).fill(baseH))];

    // Auto-expand row heights based on text content to prevent visual bugs
    if (data) {
        for (let r = 0; r < rows; r++) {
            let maxRowH = rowHeights[r];
            for (let c = 0; c < cols; c++) {
                const colW = colWidths[c];
                const cellData = data[r] && data[r][c];
                const cellText = cellData?.text !== undefined ? cellData.text : ((hasHeader && r === 0) ? '標題' : '內容');
                
                if (!cellText) continue;

                const cellFontSize = cellData?.fontSize || tableFontSize;
                const cellFontFamily = cellData?.fontFamily || tableFontFamily;
                
                const tempText = new fabric.Textbox(cellText, {
                    width: Math.max(10, colW - 20),
                    fontSize: cellFontSize,
                    fontFamily: cellFontFamily,
                    splitByGrapheme: false,
                });
                
                const requiredH = tempText.height + 20; // 10px padding top/bottom
                if (requiredH > maxRowH) {
                    maxRowH = requiredH;
                }
            }
            rowHeights[r] = maxRowH;
        }
        // Write back so the caller can save the updated heights
        options.rowHeights = rowHeights;
    }
    
    const tableW = colWidths.reduce((a, b) => a + b, 0);
    const tableH = rowHeights.reduce((a, b) => a + b, 0);
    
    const objs = [];
    
    const allOuterBorders = borderTop && borderBottom && borderLeft && borderRight;

    // Background (for default/minimal or overall background)
    objs.push(new fabric.Rect({
        left: 0, top: 0,
        width: tableW, height: tableH,
        fill: tableBgColor,
        isTableBg: true,
        originX: 'left', originY: 'top',
        rx: isHanddrawn ? 8 : 4,
        ry: isHanddrawn ? 8 : 4,
        selectable: false, evented: false
    }));

    // Striped background for even rows
    if (tableTemplate === 'striped') {
        let currentY = 0;
        for (let r = 0; r < rows; r++) {
            const rowH = rowHeights[r];
            if (r % 2 === 0) {
                const stripeBg = tableStripeColor || '#f0f4f8';
                objs.push(new fabric.Rect({
                    left: 0, top: currentY,
                    width: tableW, height: rowH,
                    fill: stripeBg,
                    originX: 'left', originY: 'top',
                    rx: r === 0 ? (isHanddrawn ? 8 : 4) : (r === rows - 1 ? (isHanddrawn ? 8 : 4) : 0),
                    ry: r === 0 ? (isHanddrawn ? 8 : 4) : (r === rows - 1 ? (isHanddrawn ? 8 : 4) : 0),
                    selectable: false, evented: false
                }));
            }
            currentY += rowH;
        }
    }

    // Header Background
    if (hasHeader) {
        objs.push(new fabric.Rect({
            left: 0, top: 0,
            width: tableW, height: rowHeights[0],
            fill: headerBgColor,
            originX: 'left', originY: 'top',
            rx: isHanddrawn ? 8 : 4,
            ry: isHanddrawn ? 8 : 4,
            selectable: false, evented: false
        }));
    }

    let seed = 12345;

    // Horizontal lines
    let currentY = 0;
    for (let i = 0; i <= rows; i++) {
        let drawLine = false;
        
        const skipOuter = allOuterBorders && !isHanddrawn;
        if (i === 0) drawLine = borderTop && !skipOuter;
        else if (i === rows) drawLine = borderBottom && !skipOuter;
        else drawLine = borderInnerH;

        if (drawLine) {
            if (isHanddrawn) {
                let d = `M 0 ${currentY}`;
                const segments = 5;
                const segmentW = tableW / segments;
                for (let s = 1; s <= segments; s++) {
                    const px = s * segmentW;
                    const py = currentY + (seededRandom(seed++) - 0.5) * 4;
                    d += ` L ${px} ${py}`;
                }
                objs.push(new fabric.Path(d, {
                    fill: '', stroke: tableBorderColor, strokeWidth: tableBorderWidth,
                    originX: 'left', originY: 'top',
                    selectable: false, evented: false
                }));
            } else {
                objs.push(new fabric.Rect({ 
                    left: 0, top: currentY - tableBorderWidth/2, 
                    width: tableW, height: tableBorderWidth, 
                    fill: tableBorderColor, originX: 'left', originY: 'top',
                    selectable: false, evented: false
                }));
            }
        }
        if (i < rows) currentY += rowHeights[i];
    }

    // Add invisible row resizer handles for inner AND outer borders
    let resizerY = 0;
    for (let i = 1; i <= rows; i++) {
        resizerY += rowHeights[i - 1];
        objs.push(new fabric.Rect({
            left: 0, top: resizerY - 10,
            width: tableW, height: 20,
            fill: 'rgba(0,0,0,0.01)',
            originX: 'left', originY: 'top',
            selectable: false, evented: true,
            hoverCursor: 'row-resize',
            isRowResizer: true,
            resizerIndex: i
        }));
    }

    // Vertical lines
    let currentX = 0;
    for (let j = 0; j <= cols; j++) {
        let drawLine = false;
        
        const skipOuter = allOuterBorders && !isHanddrawn;
        if (j === 0) drawLine = borderLeft && !skipOuter;
        else if (j === cols) drawLine = borderRight && !skipOuter;
        else drawLine = borderInnerV;

        if (tableTemplate === 'minimal' && j > 0 && j < cols) {
            drawLine = false;
        }

        if (drawLine) {
            if (isHanddrawn) {
                let d = `M ${currentX} 0`;
                const segments = 5;
                const segmentH = tableH / segments;
                for (let s = 1; s <= segments; s++) {
                    const py = s * segmentH;
                    const px = currentX + (seededRandom(seed++) - 0.5) * 4;
                    d += ` L ${px} ${py}`;
                }
                objs.push(new fabric.Path(d, {
                    fill: '', stroke: tableBorderColor, strokeWidth: tableBorderWidth,
                    originX: 'left', originY: 'top',
                    selectable: false, evented: false
                }));
            } else {
                objs.push(new fabric.Rect({ 
                    left: currentX - tableBorderWidth/2, top: 0, 
                    width: tableBorderWidth, height: tableH, 
                    fill: tableBorderColor, originX: 'left', originY: 'top',
                    selectable: false, evented: false 
                }));
            }
        }
        if (j < cols) currentX += colWidths[j];
    }

    // Unified Outer Border
    if (allOuterBorders && !isHanddrawn) {
        objs.push(new fabric.Rect({
            left: 0, top: 0,
            width: tableW, height: tableH,
            fill: 'transparent',
            originX: 'left', originY: 'top',
            rx: 4, ry: 4,
            stroke: tableBorderColor,
            strokeWidth: tableBorderWidth,
            selectable: false, evented: false
        }));
    }

    // Add invisible column resizer handles for inner AND outer borders
    let resizerX = 0;
    for (let j = 1; j <= cols; j++) {
        resizerX += colWidths[j - 1];
        objs.push(new fabric.Rect({
            left: resizerX - 10, top: 0,
            width: 20, height: tableH,
            fill: 'rgba(0,0,0,0.01)',
            originX: 'left', originY: 'top',
            selectable: false, evented: true,
            hoverCursor: 'col-resize',
            isColResizer: true,
            resizerIndex: j 
        }));
    }

    // Text cells
    let cellY = 0;
    for (let r = 0; r < rows; r++) {
        let cellX = 0;
        const rowH = rowHeights[r];
        for (let c = 0; c < cols; c++) {
            const colW = colWidths[c];
            const isHeaderRow = hasHeader && r === 0;
            const cellData = (data && data[r] && data[r][c]) ? data[r][c] : undefined;
            const cellText = cellData?.text !== undefined ? cellData.text : (isHeaderRow ? '標題' : '內容');
            
            const cellFontSize = cellData?.fontSize || tableFontSize;
            const cellFill = cellData?.fill || (isHeaderRow ? headerTextColor : tableTextColor);
            const cellFontFamily = cellData?.fontFamily || tableFontFamily;
            const cellTextAlign = cellData?.textAlign || tableTextAlign;
            const cellVerticalAlign = cellData?.verticalAlign || tableVerticalAlign;
            
            const text = new fabric.Textbox(cellText, {
                left: cellX + 10,
                top: cellY + 10,
                width: Math.max(10, colW - 20),
                fontSize: cellFontSize,
                fill: cellFill,
                fontFamily: cellFontFamily,
                textAlign: cellTextAlign,
                splitByGrapheme: false,
                isCell: true,
                rowIndex: r,
                colIndex: c,
                originX: 'left', originY: 'top',
                lockMovementX: true, lockMovementY: true,
                hasControls: false,
                selectable: false,
                evented: true
            });

            if (cellVerticalAlign === 'middle') {
                text.set('top', cellY + Math.max(10, (rowH - text.height) / 2));
            } else if (cellVerticalAlign === 'bottom') {
                text.set('top', cellY + Math.max(10, rowH - text.height - 10));
            }

            objs.push(text);
            cellX += colW;
        }
        cellY += rowH;
    }

    const group = new fabric.Group(objs, {
        isTable: true,
        tableRows: rows,
        tableCols: cols,
        colWidths: colWidths,
        rowHeights: rowHeights,
        cellW: baseW,
        cellH: baseH,
        hasHeader: !!hasHeader,
        isHanddrawn: !!isHanddrawn,
        tableBgColor,
        headerBgColor,
        tableBorderColor,
        tableFontSize,
        tableTextColor,
        headerTextColor,
        tableTemplate,
        tableStripeColor,
        tableTextAlign,
        tableVerticalAlign,
        tableFontFamily,
        borderTop,
        borderBottom,
        borderLeft,
        borderRight,
        borderInnerH,
        borderInnerV,
        tableBorderWidth,
        subTargetCheck: true,
        interactive: true,
        lockUniScaling: false
    });
    
    // Set origin to left/top AFTER construction so Fabric correctly offsets internal children first
    group.set({
        originX: 'left',
        originY: 'top'
    });
    
    return group;
};

// Extract data from an existing table group
export const extractTableData = (group) => {
    const data = [];
    const objects = group.getObjects();
    
    for (const obj of objects) {
        if (obj.isCell) {
            const r = obj.rowIndex;
            const c = obj.colIndex;
            if (!data[r]) data[r] = [];
            const isHeaderRow = group.hasHeader && r === 0;
            const defaultFill = isHeaderRow ? (group.headerTextColor || '#ffffff') : (group.tableTextColor || '#334155');
            data[r][c] = {
                text: obj.text || '',
                fontSize: obj.fontSize !== (group.tableFontSize || 16) ? obj.fontSize : undefined,
                fill: obj.fill !== defaultFill ? obj.fill : undefined,
                fontFamily: obj.fontFamily !== (group.tableFontFamily || 'Noto Sans TC') ? obj.fontFamily : undefined,
                textAlign: obj.textAlign !== (group.tableTextAlign || 'left') ? obj.textAlign : undefined,
                verticalAlign: obj.verticalAlign !== (group.tableVerticalAlign || 'top') ? obj.verticalAlign : undefined
            };
        }
    }
    
    return data;
};
