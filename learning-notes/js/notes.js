document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'EditorV2_Notes';
    const contentArea = document.querySelector('.content');
    const addNoteBtn = document.getElementById('add-note-btn');
    const notesPanel = document.getElementById('notes-panel');
    const closeNotesBtn = document.getElementById('close-notes-btn');
    const notesList = document.getElementById('notes-list');

    let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let currentSelection = null;

    // ----- 初始化：載入並標記筆記 -----
    function initNotes() {
        renderNotesPanel();
        notes.forEach(note => restoreHighlight(note));
    }

    function saveNotes() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }

    // ----- 文字反白與浮動按鈕邏輯 -----
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        if (!selection.rangeCount || selection.isCollapsed) {
            hideAddNoteBtn();
            return;
        }

        // 確認選取範圍是否在 content 內
        const range = selection.getRangeAt(0);
        if (!contentArea.contains(range.commonAncestorContainer)) {
            hideAddNoteBtn();
            return;
        }

        const text = selection.toString().trim();
        if (text.length === 0) {
            hideAddNoteBtn();
            return;
        }

        // 尋找所屬章節
        let section = range.commonAncestorContainer;
        while (section && (!section.classList || !section.classList.contains('page-section'))) {
            section = section.parentNode;
        }
        if (!section) return;

        currentSelection = {
            sectionId: section.id,
            textQuote: text,
            range: range.cloneRange()
        };

        showAddNoteBtn(range);
    });

    function showAddNoteBtn(range) {
        const rect = range.getBoundingClientRect();
        addNoteBtn.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
        addNoteBtn.style.top = `${rect.top + window.scrollY}px`;
        addNoteBtn.classList.add('show');
    }

    function hideAddNoteBtn() {
        addNoteBtn.classList.remove('show');
    }

    // 點擊「新增筆記」
    addNoteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!currentSelection) return;

        const newNote = {
            id: 'note_' + Date.now(),
            sectionId: currentSelection.sectionId,
            textQuote: currentSelection.textQuote,
            content: '',
            timestamp: Date.now()
        };

        notes.push(newNote);
        saveNotes();
        
        // 畫螢光筆
        applyHighlightToRange(currentSelection.range, newNote.id);
        
        // 清除選取狀態
        window.getSelection().removeAllRanges();
        hideAddNoteBtn();
        
        // 打開面板並進入編輯模式
        renderNotesPanel();
        openNotesPanel();
        
        setTimeout(() => {
            const textarea = document.querySelector(`.note-item[data-id="${newNote.id}"] textarea`);
            if(textarea) textarea.focus();
        }, 300);
    });

    // ----- 高亮還原邏輯 -----
    function restoreHighlight(note) {
        const section = document.getElementById(note.sectionId);
        if (!section) return;
        
        // 使用 TreeWalker 尋找文字節點
        const treeWalker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, null, false);
        let currentNode = treeWalker.nextNode();
        
        while (currentNode) {
            const textContent = currentNode.nodeValue;
            const index = textContent.indexOf(note.textQuote);
            
            if (index !== -1) {
                const range = document.createRange();
                range.setStart(currentNode, index);
                range.setEnd(currentNode, index + note.textQuote.length);
                applyHighlightToRange(range, note.id);
                return; // 只標記第一個匹配的
            }
            currentNode = treeWalker.nextNode();
        }
    }

    function applyHighlightToRange(range, noteId) {
        try {
            const mark = document.createElement('mark');
            mark.className = 'note-highlight';
            mark.setAttribute('data-note-id', noteId);
            range.surroundContents(mark);
            
            // 點擊高亮處打開對應筆記
            mark.addEventListener('click', (e) => {
                e.stopPropagation();
                openNotesPanel();
                scrollToNote(noteId);
            });
        } catch (e) {
            console.warn("Could not highlight range (might cross HTML boundaries):", e);
        }
    }

    // ----- 面板操作 -----
    function openNotesPanel() {
        notesPanel.classList.add('open');
    }

    closeNotesBtn.addEventListener('click', () => {
        notesPanel.classList.remove('open');
    });

    function renderNotesPanel() {
        if (notes.length === 0) {
            notesList.innerHTML = '<div style="color:var(--text-3); text-align:center; margin-top:40px; font-size:13px;">目前沒有任何筆記。<br>請在左側選取一段文字來新增筆記！</div>';
            return;
        }

        // 依時間反序排列
        const sorted = [...notes].sort((a,b) => b.timestamp - a.timestamp);
        
        notesList.innerHTML = sorted.map(note => `
            <div class="note-item" data-id="${note.id}">
                <div class="note-quote">"${note.textQuote}"</div>
                <textarea class="note-textarea" placeholder="在這裡輸入筆記內容...">${note.content}</textarea>
                <div class="note-actions">
                    <button class="btn btn-sm btn-danger delete-btn">刪除</button>
                    <button class="btn btn-sm btn-primary save-btn">儲存</button>
                </div>
            </div>
        `).join('');

        // 綁定事件
        notesList.querySelectorAll('.note-item').forEach(el => {
            const id = el.getAttribute('data-id');
            const textarea = el.querySelector('textarea');
            
            el.querySelector('.save-btn').addEventListener('click', () => {
                const target = notes.find(n => n.id === id);
                if (target) {
                    target.content = textarea.value;
                    target.timestamp = Date.now(); // 更新時間
                    saveNotes();
                    el.classList.remove('editing');
                    
                    // 顯示儲存成功提示
                    const btn = el.querySelector('.save-btn');
                    btn.textContent = '已儲存';
                    setTimeout(() => btn.textContent = '儲存', 2000);
                }
            });

            el.querySelector('.delete-btn').addEventListener('click', () => {
                if(confirm('確定要刪除這則筆記嗎？')) {
                    notes = notes.filter(n => n.id !== id);
                    saveNotes();
                    // 移除高亮
                    document.querySelectorAll(`mark[data-note-id="${id}"]`).forEach(mark => {
                        const parent = mark.parentNode;
                        while(mark.firstChild) parent.insertBefore(mark.firstChild, mark);
                        parent.removeChild(mark);
                    });
                    renderNotesPanel();
                }
            });

            textarea.addEventListener('input', () => {
                el.classList.add('editing');
            });
            
            // 點擊筆記框，滾動到文章段落
            el.addEventListener('click', (e) => {
                if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'TEXTAREA') {
                    const mark = document.querySelector(`mark[data-note-id="${id}"]`);
                    if(mark) {
                        // 切換到該 Tab
                        const section = mark.closest('.page-section');
                        if (section && typeof window.switchSection === 'function') {
                            window.switchSection(section.id);
                        }
                        
                        // 滾動並閃爍提示
                        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        mark.classList.add('active');
                        setTimeout(() => mark.classList.remove('active'), 2000);
                    }
                }
            });
        });
    }

    function scrollToNote(id) {
        const item = document.querySelector(`.note-item[data-id="${id}"]`);
        if (item) {
            item.scrollIntoView({ behavior: 'smooth', block: 'start' });
            item.style.transform = 'scale(1.02)';
            item.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
            setTimeout(() => {
                item.style.transform = 'none';
                item.style.boxShadow = 'none';
            }, 500);
        }
    }

    // 啟動
    initNotes();
});
