const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'data', 'db.json');

if (!fs.existsSync(dbPath)) {
  console.log('❌ База данных (db.json) не найдена.');
  process.exit(1);
}

try {
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const tasks = dbData.tasks || [];
  
  const idCounts = {};
  const duplicates = [];

  // Ищем дубликаты
  tasks.forEach(t => {
    if (!idCounts[t.id]) idCounts[t.id] = 0;
    idCounts[t.id]++;
    if (idCounts[t.id] > 1) duplicates.push(t);
  });

  if (duplicates.length === 0) {
    console.log('✅ Дубликатов не найдено. База в порядке!');
    process.exit(0);
  }

  console.log(\`⚠️ Найдено \${duplicates.length} дубликатов задач. Исправляем...\`);

  // Находим максимальный ID для генерации новых
  let maxIdNum = 100;
  tasks.forEach(t => {
    const m = t.id && String(t.id).match(/^NEX-(\\d+)$/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxIdNum) maxIdNum = num;
    }
  });

  // Переназначаем ID
  let fixedCount = 0;
  const seenIds = new Set();
  
  tasks.forEach(t => {
    if (seenIds.has(t.id)) {
      maxIdNum++;
      const oldId = t.id;
      t.id = \`NEX-\${maxIdNum}\`;
      console.log(\`🔄 Исправлено: \${oldId} -> \${t.id} ("\${t.title}")\`);
      fixedCount++;
    }
    seenIds.add(t.id);
  });

  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log(\`✅ Успешно исправлено задач: \${fixedCount}\`);
} catch (e) {
  console.error('❌ Ошибка при исправлении базы:', e);
}
