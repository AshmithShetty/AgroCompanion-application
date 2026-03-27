const aedes = require('aedes')();
const ws = require('websocket-stream');

aedes.attachServer = function(httpServer) {
  ws.createServer({ server: httpServer }, aedes.handle);
};

module.exports = aedes;