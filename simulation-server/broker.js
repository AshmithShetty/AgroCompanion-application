const aedes = require('aedes')();
const ws = require('websocket-stream');

function setupBroker(httpServer) {
  ws.createServer({ server: httpServer }, aedes.handle);
  return aedes;
}

module.exports = setupBroker;