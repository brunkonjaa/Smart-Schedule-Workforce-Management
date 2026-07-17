const app = require('./app');
const config = require('./config/env');
const { setupChatWebSocket } = require('./services/chat-ws');

const port = config.port;

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

setupChatWebSocket(server);

module.exports = server;
