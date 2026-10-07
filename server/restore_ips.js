import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUPS_DIR = path.join(__dirname, 'data', 'backups');
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const restoreBannedIps = () => {
  console.log('Начало хирургического восстановления bannedIps...');

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.error('❌ Папка с бэкапами не найдена!');
    process.exit(1);
  }

  const files = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
    .sort()
    .reverse(); // От самых новых к самым старым

  let foundBannedIps = null;
  let sourceFile = '';

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(BACKUPS_DIR, file), 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.bannedIps && Array.isArray(parsed.bannedIps) && parsed.bannedIps.length > 0) {
        foundBannedIps = parsed.bannedIps;
        sourceFile = file;
        break; // Нашли самый свежий бэкап, где таблица еще была жива
      }
    } catch (e) {}
  }

  if (!foundBannedIps) {
    console.error('❌ Ни в одном бэкапе не найдено записей bannedIps. Возможно, они были пустые изначально.');
    process.exit(1);
  }

  console.log('📦 Найдено ' + foundBannedIps.length + ' заблокированных IP в бэкапе: ' + sourceFile);

  if (!fs.existsSync(DB_FILE)) {
    console.error('❌ Текущий файл db.json не найден!');
    process.exit(1);
  }

  const currentRaw = fs.readFileSync(DB_FILE, 'utf-8');
  const currentData = JSON.parse(currentRaw);

  currentData.bannedIps = foundBannedIps;

  fs.writeFileSync(DB_FILE, JSON.stringify(currentData, null, 2), 'utf-8');
  console.log('🎉 Коллекция bannedIps успешно внедрена в текущую базу данных! Текущие задачи и приказы не пострадали.');
};

restoreBannedIps();
