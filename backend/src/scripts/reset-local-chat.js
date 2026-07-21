process.env.NODE_ENV = 'test';

const config = require('../config/env');
const { closePool, isLocalDatabaseUrl, withTransaction } = require('../config/db');

const run = async () => {
  if (!isLocalDatabaseUrl(config.databaseUrl)) {
    throw new Error('Chat reset is restricted to a local PostgreSQL database.');
  }

  const result = await withTransaction(async (client) => {
    const readStates = await client.query('DELETE FROM chat_read_states');
    const messages = await client.query('DELETE FROM chat_messages');
    const directConversations = await client.query(
      "DELETE FROM chat_conversations WHERE kind = 'DIRECT'"
    );
    await client.query(
      "INSERT INTO chat_conversations (kind) VALUES ('WORKPLACE') ON CONFLICT DO NOTHING"
    );

    return {
      directConversations: directConversations.rowCount,
      messages: messages.rowCount,
      readStates: readStates.rowCount
    };
  });

  console.log(`Local chat messages removed: ${result.messages}`);
  console.log(`Local chat read states removed: ${result.readStates}`);
  console.log(`Local direct conversations removed: ${result.directConversations}`);
  console.log('The workplace room is ready for new messages.');
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
