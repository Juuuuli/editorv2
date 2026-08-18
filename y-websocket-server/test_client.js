const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:4444/room1');

ws.on('open', function open() {
  console.log('Connected to server');
  ws.send('test message');
});

ws.on('message', function incoming(data) {
  console.log('Received:', data);
});

ws.on('error', function error(e) {
  console.error('Error:', e);
});
