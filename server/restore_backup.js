import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;
const BACKUP_DIR = path.join(process.cwd(), 'server', 'data', 'backups');

const connectionString = process.env.DATABASE_URL || 'postgresql://pulse12_admin:Pulse2026SecureDBPass@postgres_db:5432/pulse12';

const restore = async () => {
  console.log('Поиск резервных копий в', BACKUP_DIR);
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error('❌ Папка с бэкапами не найдена!');
    process.exit(1);
  }

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.error('❌ Бэкапы не найдены!');
    process.exit(1);
  }

  // Выводим все доступные бэкапы
  console.log('Доступные бэкапы:');
  files.forEach((f, i) => console.log(`${i + 1}. ${f}`));

  const latestBackup = files[files.length - 1];
  console.log(`\n📦 Автоматически выбран последний бэкап: ${latestBackup}`);
  
  const raw = fs.readFileSync(path.join(BACKUP_DIR, latestBackup), 'utf-8');
  const backupData = JSON.parse(raw);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE pulse_store');
    console.log('🗑️ Текущая база данных очищена.');

    let count = 0;
    for (const [key, val] of Object.entries(backupData)) {
      if (key && val) {
        await client.query('INSERT INTO pulse_store (key, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)', [key, JSON.stringify(val)]);
        console.log(`✅ Восстановлена коллекция: ${key} (элементов: ${Array.isArray(val) ? val.length : Object.keys(val).length})`);
        count++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`\n🎉 Успешно восстановлено ${count} коллекций из бэкапа!`);
    console.log('ОБЯЗАТЕЛЬНО ПЕРЕЗАПУСТИТЕ СЕРВЕР ЧТОБЫ ИЗМЕНЕНИЯ ВСТУПИЛИ В СИЛУ!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при восстановлении:', err);
  } finally {
    client.release();
    pool.end();
  }
};

restore();
