import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const MAX_BACKUPS = 15;

const ensureBackupDir = async () => {
  try {
    await fs.access(BACKUP_DIR);
  } catch (err) {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }
};

export const createSnapshot = async (dbData) => {
  try {
    await ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const filename = `snapshot_${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    // Save backup
    await fs.writeFile(filepath, JSON.stringify(dbData, null, 2), 'utf8');
    console.log(`[Backup] Создан авто-снапшот базы данных: ${filename}`);

    // Cleanup old backups
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files.filter(f => f.startsWith('snapshot_') && f.endsWith('.json'));
    
    if (backups.length > MAX_BACKUPS) {
      // Sort by modified time or just filename since it has timestamp
      backups.sort().reverse();
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        await fs.unlink(path.join(BACKUP_DIR, file));
        console.log(`[Backup] Удален старый снапшот: ${file}`);
      }
    }
  } catch (err) {
    console.error('[Backup] Ошибка при создании авто-снапшота:', err.message);
  }
};

export const startAutoBackup = (getDbData) => {
  // Запускаем сразу при старте (отложенно на 5 сек, чтобы база загрузилась)
  setTimeout(async () => {
    try {
      const data = await getDbData();
      await createSnapshot(data);
    } catch(e) { console.error(e); }
  }, 5000);

  // И затем каждые 24 часа
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const data = await getDbData();
      await createSnapshot(data);
    } catch(e) { console.error(e); }
  }, TWENTY_FOUR_HOURS);
};
