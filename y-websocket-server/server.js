const { setupWSConnection } = require('y-websocket/bin/utils')
const http = require('http')
const { WebSocketServer } = require('ws')

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('y-websocket server is running')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  // setupWSConnection 內部會自動處理房間與 CRDT 的同步邏輯
  setupWSConnection(ws, req)
})

const port = process.env.PORT || 4444
server.listen(port, () => {
  console.log(`[EditorV2 WebSocket Server] 正在監聽 port ${port}`)
})
