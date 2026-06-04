const app = require('./app');
const config = require('./config/env');

const port = config.port;

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = server;
