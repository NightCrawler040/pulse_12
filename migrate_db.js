import fs from 'fs';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'server', 'data', 'db.json');

const connectionString = process.env.DATABASE_URL || 'postgresql://pulse12_admin:Pulse2026SecureDBPass@postgres_db:5432/pulse12';

const migrate = async () => {
  console.log('Начало принудительной миграции из db.json в PostgreSQL...');
  
  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ Файл db.json не найден по пути:', DB_FILE);
    process.exit(1);
  }

  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const migrationData = JSON.parse(raw);
  
  if (!migrationData || !migrationData.users) {
    console.error('❌ Некорректный db.json');
    process.exit(1);
  }

  console.log(\`📦 Загружено \${migrationData.users.length} пользователей из db.json\`);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Очищаем текущую базу
    await client.query('TRUNCATE TABLE pulse_store');
    console.log('🗑️ Таблица pulse_store очищена.');

    for (const key of Object.keys(migrationData)) {
      if (key === 'mailSettings' || key === 'notificationEvents') continue; // Это другие таблицы
      
      const query = \`
        INSERT INTO pulse_store (key, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET data = $2, updated_at = CURRENT_TIMESTAMP;
      \`;
      await client.query(query, [key, JSON.stringify(migrationData[key])]);
      console.log(\`✅ Восстановлена коллекция: \${key}\`);
    }

    await client.query('COMMIT');
    console.log('🎉 Миграция успешно завершена! Данные восстановлены из db.json в PostgreSQL.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка миграции:', err);
  } finally {
    client.release();
    pool.end();
  }
};

migrate();
