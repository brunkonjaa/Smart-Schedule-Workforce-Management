const { closePool, query } = require('../backend/src/config/db');

const main = async () => {
  const columns = await query(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position`
  );
  columns.rows.forEach((row) => {
    console.log([row.table_name, row.column_name, row.data_type, row.is_nullable].join('|'));
  });

  console.log('FKS');
  const foreignKeys = await query(
    `SELECT tc.table_name, kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints AS tc
     INNER JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     INNER JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
     ORDER BY tc.table_name, kcu.column_name`
  );
  foreignKeys.rows.forEach((row) => {
    console.log([
      row.table_name,
      row.column_name,
      row.foreign_table_name,
      row.foreign_column_name
    ].join('|'));
  });
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(closePool);
