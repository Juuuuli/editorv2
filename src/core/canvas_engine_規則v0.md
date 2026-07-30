# 畫布引擎核心規則 (v0)

## 1. 模組定位
封裝底層圖形渲染庫 (Fabric.js/Konva.js)，為上層工具模組提供統一的畫布操作介面，負責管理畫布大小、物件群組與邊界碰撞。

## 2. 輸入與輸出
- **輸入**：接收來自各大工具模組的 `CANVAS:ADD_OBJECT`, `CANVAS:REMOVE_OBJECT`, `CANVAS:SET_MODE` 等 EventBus 事件。
- **輸出**：觸發底層重新渲染，並將畫布上的 `object:modified`, `selection:created` 等事件往外廣播給屬性面板與圖層面板。

## 3. 邊界條件與例外處理
- **物理邊界 (撞牆限制)**：無論是拖曳單一物件或「群組 (Group)」，在觸發 `object:moving` 時必須計算 BoundingBox (物件邊界框)。若超出白色畫布長寬，強制將座標 (left, top) 鎖定在邊緣，絕對不可移出畫布。
- **背景自適應**：當匯入主題檔案 (圖片/PDF) 時，必須將檔案設為不可選取的背景圖，並自動調整畫布的 width/height 完美貼合該檔案比例。
- **群組運算 (Shift 多選)**：Shift 點擊觸發多選狀態時，自動產生臨時群組 (ActiveSelection)。當接收到 `Ctrl+G` 指令時，將臨時群組轉換為實體群組 (Group)，並且群組後的邊界同樣受「撞牆限制」規範。
