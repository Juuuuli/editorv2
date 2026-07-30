import './style.css';
import EventBus from './shared/EventBus.js';
import CanvasEngine from './core/CanvasEngine.js';
import WorkspaceManager from './features/workspace/WorkspaceManager.js';
import ThumbnailsPanel from './features/thumbnails/ThumbnailsPanel.js';
import BasicTools from './features/tools/basic/BasicTools.js';
import PanelManager from './features/panels/PanelManager.js';
import PropertiesPanel from './features/panels/PropertiesPanel.js';
import LayersPanel from './features/panels/LayersPanel.js';
import AssetsPanel from './features/panels/AssetsPanel.js';
import KeyboardShortcuts from './features/tools/shared/KeyboardShortcuts.js';
import ObjectsTools from './features/tools/objects/ObjectsTools.js';
import SmartTools from './features/tools/smart/SmartTools.js';
import FileImportManager from './features/workspace/FileImportManager.js';
import RatioManager from './features/workspace/RatioManager.js';
import ExportManager from './features/workspace/ExportManager.js';
import FloatingToolsManager from './features/floating_tools/FloatingToolsManager.js';
import ManualPanel from './features/system/ManualPanel.js';
import ContextualHelper from './features/system/ContextualHelper.js';

document.addEventListener('DOMContentLoaded', () => {
    // 實例化全域 EventBus
    const eventBus = new EventBus();

    // 內部測試防護 (Password Gate)
    const passwordGate = document.getElementById('password-gate');
    const pwdInput = document.getElementById('demo-password-input');
    const pwdError = document.getElementById('demo-password-error');
    const btnLogin = document.getElementById('btn-demo-login');
    
    if (sessionStorage.getItem('demo_unlocked') === 'true') {
        passwordGate.classList.add('hidden');
    } else {
        const attemptLogin = () => {
            if (pwdInput.value === 'DEMO2026') {
                sessionStorage.setItem('demo_unlocked', 'true');
                passwordGate.classList.add('hidden');
            } else {
                pwdError.classList.remove('hidden');
                pwdInput.classList.add('border-rose-500');
            }
        };
        btnLogin.addEventListener('click', attemptLogin);
        pwdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
    }

    // 綁定 Loading UI
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    
    eventBus.on('LOADING:START', (data) => {
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
            if (loadingMessage && data && data.message) {
                loadingMessage.innerText = data.message;
            }
        }
    });

    eventBus.on('LOADING:END', () => {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    });

    // 初始化核心系統

    // 實例化畫布引擎
    const canvasEngine = new CanvasEngine('main-canvas', {
        width: 1280,
        height: 720
    }, eventBus);

    // 實例化 Sprint 1 模組
    const workspaceManager = new WorkspaceManager(eventBus);
    const thumbnailsPanel = new ThumbnailsPanel(eventBus, 'thumbnails-container');
    const basicTools = new BasicTools(canvasEngine, eventBus);
    
    // 初始化預設工具模式為「選取」
    basicTools.setMode('selection');

    // 實例化 Sprint 2 模組
    const panelManager = new PanelManager(eventBus);
    const propertiesPanel = new PropertiesPanel(eventBus, canvasEngine);
    const layersPanel = new LayersPanel(eventBus, canvasEngine);
    const assetsPanel = new AssetsPanel(canvasEngine, eventBus);
    const keyboardShortcuts = new KeyboardShortcuts(eventBus, canvasEngine);

    // 實例化 Sprint 3 模組
    const objectsTools = new ObjectsTools(canvasEngine, eventBus);
    
    // 初始化智慧工具
    const smartTools = new SmartTools(canvasEngine, eventBus);
    
    // 初始化 Floating Tools
    const floatingToolsManager = new FloatingToolsManager(canvasEngine, eventBus);

    console.log('多媒體畫布編輯器V2 - Sprint 1 系統初始化完成');

    // Undo / Redo
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) {
        btnUndo.addEventListener('click', () => {
            canvasEngine.undo();
        });
    }
    if (btnRedo) {
        btnRedo.addEventListener('click', () => {
            canvasEngine.redo();
        });
    }
    // 初始化檔案匯入管理員
    const fileImportManager = new FileImportManager(canvasEngine, eventBus, workspaceManager);

    // 初始化匯出管理員
    const exportManager = new ExportManager(canvasEngine, eventBus, workspaceManager);

    // 實例化畫布比例管理員
    const ratioManager = new RatioManager(canvasEngine, eventBus);

    // 實例化說明書面板
    const manualPanel = new ManualPanel(eventBus);
    const btnManual = document.getElementById('btn-manual');
    if (btnManual) {
        btnManual.addEventListener('click', () => {
            manualPanel.open();
        });
    }

    // 實例化情境輔助與工具提示
    const contextualHelper = new ContextualHelper(eventBus);
});
