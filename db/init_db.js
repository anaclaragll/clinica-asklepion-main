const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'clinica.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function run() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error('schema.sql não encontrado em', SCHEMA_PATH);
    process.exit(1);
  }

  const schema = fs.readFileSync(SCHEMA_PATH, { encoding: 'utf8' });

  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Erro ao abrir o banco:', err.message);
      process.exit(1);
    }
  });

  db.exec('PRAGMA foreign_keys = ON;', (err) => {
    if (err) console.warn('Não foi possível ativar foreign_keys:', err.message);

    db.exec(schema, (err) => {
      if (err) {
        console.error('Erro ao executar schema.sql:', err.message);
        db.close();
        process.exit(1);
      }

      console.log('Banco inicializado em', DB_PATH);
      db.close();
    });
  });
}

if (require.main === module) run();

module.exports = { run };
