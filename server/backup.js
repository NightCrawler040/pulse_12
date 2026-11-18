import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const MAX_BACKUPS = 25;

const ensureBackupDir = async () => {
  try {
    await fs.access(BACKUP_DIR);
  } catch (err) {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }
};

const redactSecrets = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      if (['password', 'pin', 'apiToken', 'bindPassword', 'key'].includes(key)) {
        newObj[key] = '[REDACTED]';
      } else {
        newObj[key] = redactSecrets(value);
      }
    }
    return newObj;
  }
  return obj;
};

export const createSnapshot = async (dbData, prefix = 'snapshot') => {
  try {
    await ensureBackupDir();
    const redactedData = redactSecrets(dbData);
    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const safePrefix = String(prefix || 'snapshot').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safePrefix}_${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    await fs.writeFile(filepath, JSON.stringify(redactedData, null, 2), 'utf8');
    console.log(`[Backup] Создан снапшот базы данных: ${filename}`);

    // Cleanup old auto-snapshots
    const files = await fs.readdir(BACKUP_DIR);
    const backups = files.filter(f => f.startsWith('snapshot_') && f.endsWith('.json'));
    
    if (backups.length > MAX_BACKUPS) {
      backups.sort().reverse();
      const toDelete = backups.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        await fs.unlink(path.join(BACKUP_DIR, file));
        console.log(`[Backup] Удален старый снапшот: ${file}`);
      }
    }
    return filename;
  } catch (err) {
    console.error('[Backup] Ошибка при создании снапшота:', err.message);
    return null;
  }
};

export const listSnapshots = async () => {
  try {
    await ensureBackupDir();
    const files = await fs.readdir(BACKUP_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const items = [];
    for (const f of jsonFiles) {
      try {
        const st = await fs.stat(path.join(BACKUP_DIR, f));
        items.push({
          filename: f,
          size: st.size,
          createdAt: st.mtime.toISOString(),
          type: f.startsWith('sprint_') ? 'sprint' : f.startsWith('hr_jml_') ? 'hr_jml' : 'full'
        });
      } catch (e) {}
    }
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    return [];
  }
};

export const readSnapshotFile = async (filename) => {
  await ensureBackupDir();
  const safeName = path.basename(String(filename || ''));
  if (!safeName.endsWith('.json')) throw new Error('Invalid backup filename');
  const fullPath = path.join(BACKUP_DIR, safeName);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
};

export const startAutoBackup = (getDbData) => {
  setTimeout(async () => {
    try {
      const data = await getDbData();
      await createSnapshot(data, 'snapshot');
    } catch(e) { console.error(e); }
  }, 5000);

  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      const data = await getDbData();
      await createSnapshot(data, 'snapshot');
    } catch(e) { console.error(e); }
  }, TWENTY_FOUR_HOURS);
};
