// Mermaid 初始化
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#EAF3DE',
    primaryTextColor: '#1a1a18',
    primaryBorderColor: '#3B6D11',
    lineColor: '#6b6a64',
    secondaryColor: '#E6F1FB',
    tertiaryColor: '#f1f0ec',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif',
    fontSize: '13px'
  },
  flowchart: { curve: 'basis', padding: 15 },
  sequence: { actorMargin: 40, messageFontSize: 12 }
});

// 章節切換邏輯
const navLinks = document.querySelectorAll('.nav a[data-section]');
const sections = document.querySelectorAll('.page-section');
const crumbSection = document.getElementById('crumb-section');
const crumbPage = document.getElementById('crumb-page');

const sectionMeta = {
  'sec-overview': { title: '系統總覽', subtitle: 'EditorV2 多媒體畫布編輯器' },
  'sec-core': { title: '核心引擎', subtitle: 'CanvasEngine / ProjectRouter / AIProviderAdapter' },
  'sec-eventbus': { title: 'EventBus', subtitle: 'Pub/Sub 事件匯流排' },
  'sec-tools': { title: '畫布工具', subtitle: 'BasicTools / ObjectsTools / SmartTools' },
  'sec-panels': { title: '面板系統', subtitle: 'Panels / Properties / Layers / Assets' },
  'sec-workspace': { title: '工作區與頁面', subtitle: 'Workspace / Thumbnails / Export' },
  'sec-storage': { title: '儲存與專案', subtitle: 'ProjectStorageEngine / DashboardManager' },
  'sec-collab': { title: '即時協作', subtitle: 'Yjs / Firebase / Presence' },
  'sec-ai': { title: 'AI 功能', subtitle: 'AIProviderAdapter / SmartTools / Vault' },
  'sec-theme': { title: '主題與輔助', subtitle: 'ThemeManager / SmartGuides / Helper' },
  'sec-build': { title: '建置與部署', subtitle: 'Vite / Firebase / 環境設定' }
};

function switchSection(sectionId) {
  sections.forEach(s => s.classList.remove('active'));
  navLinks.forEach(a => a.classList.remove('on'));

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active');
    
    // 渲染當下 active 標籤頁內尚未處理的 Mermaid 圖表
    const unrendered = target.querySelectorAll('.mermaid:not([data-processed])');
    if (unrendered.length > 0) {
      mermaid.run({ nodes: unrendered }).catch(e => console.error("Mermaid run error:", e));
    }
  }

  const link = document.querySelector(`.nav a[data-section="${sectionId}"]`);
  if (link) link.classList.add('on');

  const meta = sectionMeta[sectionId] || {};
  crumbSection.textContent = meta.title || '';
  crumbPage.textContent = meta.subtitle || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    switchSection(link.getAttribute('data-section'));
  });
});

// 搜尋導航
const navSearch = document.getElementById('nav-search');
navSearch.addEventListener('input', () => {
  const query = navSearch.value.toLowerCase();
  navLinks.forEach(link => {
    const text = link.textContent.toLowerCase();
    link.style.display = query === '' || text.includes(query) ? '' : 'none';
  });
});

// 回頂端按鈕
const backTop = document.getElementById('back-top');
window.addEventListener('scroll', () => {
  backTop.classList.toggle('show', window.scrollY > 300);
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  Prism.highlightAll();
  
  // 渲染首頁的圖表
  const activeSection = document.querySelector('.page-section.active');
  if (activeSection) {
    const unrendered = activeSection.querySelectorAll('.mermaid:not([data-processed])');
    if (unrendered.length > 0) {
      mermaid.run({ nodes: unrendered }).catch(e => console.error(e));
    }
  }
});
// Wiki Tooltip 邏輯
const tooltipEl = document.createElement('div');
tooltipEl.className = 'wiki-tooltip';
document.body.appendChild(tooltipEl);

document.querySelectorAll('.wiki-link').forEach(link => {
  link.addEventListener('mouseenter', (e) => {
    const title = link.getAttribute('data-title');
    const desc = link.getAttribute('data-desc');
    const icon = link.getAttribute('data-icon') || 'ti-info-circle';
    
    let html = '';
    if (title) html += `<div class="tt-title"><i class="ti ${icon}"></i>${title}</div>`;
    if (desc) html += `<div class="tt-desc">${desc}</div>`;
    
    tooltipEl.innerHTML = html;
    tooltipEl.classList.add('show');
    
    const rect = link.getBoundingClientRect();
    
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;
    
    if (left + tooltipEl.offsetWidth > window.innerWidth - 20) {
      left = window.innerWidth - tooltipEl.offsetWidth - 20;
    }
    
    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  });
  
  link.addEventListener('mouseleave', () => {
    tooltipEl.classList.remove('show');
  });
});
