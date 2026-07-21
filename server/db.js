import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialUsers, initialSprints, initialTasks, initialGroups } from './initialData.js';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Настройка подключения к PostgreSQL с оптимизированным пулом и защитой от падений
const connectionString = process.env.DATABASE_URL || 'postgresql://pulse12_admin:corporate_secret_password@localhost:5432/pulse12';
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('⚠️ [PostgreSQL Pool Error] Временная ошибка соединения (не критично):', err.message);
});

let isPgConnected = false;

// Локальное файловое хранилище (для Fallback-режима без Docker/Postgres)
let localDbData = {
  tasks: [],
  sprints: [],
  users: [],
  groups: [],
  notifications: []
};

const loadLocalFile = () => {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks)) {
        localDbData = {
          tasks: (parsed.tasks && parsed.tasks.length > 0) ? parsed.tasks : initialTasks,
          sprints: (parsed.sprints && parsed.sprints.length > 0) ? parsed.sprints : initialSprints,
          users: (parsed.users && parsed.users.length >= 5) ? parsed.users : initialUsers,
          groups: (parsed.groups && parsed.groups.length > 0) ? parsed.groups : initialGroups,
          notifications: parsed.notifications || []
        };
        return;
      }
    } catch (err) {
      console.warn('⚠️ Ошибка чтения db.json, возврат к демо-данным...', err);
    }
  }
  localDbData = {
    tasks: initialTasks,
    sprints: initialSprints,
    users: initialUsers,
    groups: initialGroups,
    notifications: []
  };
  saveLocalFile();
};

let saveTimeout = null;
const saveLocalFile = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    fs.writeFile(DB_FILE, JSON.stringify(localDbData, null, 2), 'utf-8', (err) => {
      if (err) console.error('❌ Ошибка асинхронного сохранения в db.json:', err.message);
    });
  }, 300);
};

/**
 * Инициализация базы данных (проверка подключения к PostgreSQL или переключение на файл)
 */
export const initDb = async () => {
  console.log('🐘 Попытка подключения к базе данных PostgreSQL...');
  try {
    const client = await pool.connect();
    isPgConnected = true;
    console.log('✅ Успешно подключено к PostgreSQL! Создание схемы...');

    // Создание главной таблицы для хранения коллекций Pulse12 в формате JSONB
    await client.query(`
      CREATE TABLE IF NOT EXISTS pulse_store (
        key VARCHAR(64) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Проверяем, пуста ли база данных
    const res = await client.query('SELECT COUNT(*) FROM pulse_store');
    const count = parseInt(res.rows[0].count, 10);

    if (count === 0) {
      console.log('🌱 База данных PostgreSQL пуста. Инициализация стартовыми корпоративными данными (Администратор, спринты, группы)...');
      await client.query('INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['tasks', JSON.stringify(initialTasks)]);
      await client.query('INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['sprints', JSON.stringify(initialSprints)]);
      await client.query('INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['users', JSON.stringify(initialUsers)]);
      await client.query('INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['groups', JSON.stringify(initialGroups)]);
      await client.query('INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['notifications', JSON.stringify([])]);
      console.log('✅ Стартовые корпоративные данные успешно загружены в PostgreSQL!');
    } else {
      console.log(`✅ В PostgreSQL найдено ${count} коллекций данных. Проверка целостности коллекций...`);
      // Авто-восстановление пустых коллекций
      const tasksRes = await client.query("SELECT data FROM pulse_store WHERE key = 'tasks'");
      if (tasksRes.rows.length === 0 || !Array.isArray(tasksRes.rows[0].data) || tasksRes.rows[0].data.length === 0) {
        console.log('🌱 Коллекция tasks в PostgreSQL пуста. Автовосстановление корпоративных задач...');
        await client.query("INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", ['tasks', JSON.stringify(initialTasks)]);
      }
      const usersRes = await client.query("SELECT data FROM pulse_store WHERE key = 'users'");
      if (usersRes.rows.length === 0 || !Array.isArray(usersRes.rows[0].data) || usersRes.rows[0].data.length < 5) {
        console.log('🌱 Коллекция users в PostgreSQL неполная. Обновление до полного штата сотрудников...');
        await client.query("INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", ['users', JSON.stringify(initialUsers)]);
      }
      const groupsRes = await client.query("SELECT data FROM pulse_store WHERE key = 'groups'");
      if (groupsRes.rows.length === 0 || !Array.isArray(groupsRes.rows[0].data) || groupsRes.rows[0].data.length === 0) {
        await client.query("INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data", ['groups', JSON.stringify(initialGroups)]);
      }
    }

    client.release();

    // Мгновенно синхронизируем локальный fallback (localDbData и db.json) с актуальными данными из PostgreSQL
    const allPgData = await getAllData();
    if (allPgData && allPgData.users && allPgData.users.length > 0) {
      localDbData = {
        tasks: allPgData.tasks || [],
        sprints: allPgData.sprints || [],
        users: allPgData.users || [],
        groups: allPgData.groups || [],
        notifications: allPgData.notifications || []
      };
      saveLocalFile();
    }
  } catch (err) {
    console.warn(`⚠️ PostgreSQL недоступен (${err.message}). Переключение на локальный файловый режим (db.json)...`);
    isPgConnected = false;
    loadLocalFile();
  }

  // Запуск фонового мониторинга (каждые 15 сек) для автовосстановления связи с PostgreSQL
  setInterval(async () => {
    if (!isPgConnected) {
      try {
        const client = await pool.connect();
        client.release();
        isPgConnected = true;
        console.log('🔄 [Auto-Healing] PostgreSQL снова доступен! Восстановление онлайн-режима...');
        const allPgData = await getAllData();
        if (allPgData && allPgData.users && allPgData.users.length > 0) {
          localDbData = {
            tasks: allPgData.tasks || [],
            sprints: allPgData.sprints || [],
            users: allPgData.users || [],
            groups: allPgData.groups || [],
            notifications: allPgData.notifications || []
          };
          saveLocalFile();
        }
      } catch (e) {
        // Остаемся в локальном режиме db.json
      }
    }
  }, 15000);
};

/**
 * Получить коллекцию по ключу ('tasks', 'users', 'sprints', 'groups', 'notifications')
 */
export const getCollection = async (key) => {
  if (isPgConnected) {
    try {
      const res = await pool.query('SELECT data FROM pulse_store WHERE key = $1', [key]);
      if (res.rows.length > 0) {
        return res.rows[0].data;
      }
      return [];
    } catch (err) {
      console.error(`❌ Ошибка PostgreSQL при получении коллекции "${key}":`, err.message);
      isPgConnected = false;
      return localDbData[key] || [];
    }
  } else {
    return localDbData[key] || [];
  }
};

/**
 * Сохранить/обновить коллекцию по ключу
 */
export const saveCollection = async (key, dataArray) => {
  if (key === 'users' && Array.isArray(dataArray)) {
    const map = new Map();
    dataArray.forEach(u => {
      const k = u.id || u.login;
      if (k) map.set(k, { ...map.get(k), ...u });
    });
    dataArray = Array.from(map.values());
  }
  if (isPgConnected) {
    try {
      const query = `
        INSERT INTO pulse_store (key, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET data = $2, updated_at = CURRENT_TIMESTAMP;
      `;
      await pool.query(query, [key, JSON.stringify(dataArray)]);
      // Фоновое обновление локальной копии для бесшовного Failover (3)
      localDbData[key] = dataArray;
      saveLocalFile();
    } catch (err) {
      console.error(`❌ Ошибка PostgreSQL при сохранении коллекции "${key}":`, err.message);
      isPgConnected = false;
      localDbData[key] = dataArray;
      saveLocalFile();
    }
  } else {
    localDbData[key] = dataArray;
    saveLocalFile();
  }
};

/**
 * Получить все данные системы одновременно
 */
export const getAllData = async () => {
  if (isPgConnected) {
    try {
      const res = await pool.query('SELECT key, data FROM pulse_store');
      const result = {
        tasks: [],
        sprints: [],
        users: [],
        groups: [],
        notifications: []
      };
      res.rows.forEach(row => {
        if (result[row.key] !== undefined) {
          result[row.key] = row.data;
        }
      });
      return result;
    } catch (err) {
      console.error('❌ Ошибка PostgreSQL при получении всех данных:', err.message);
      isPgConnected = false;
      return { ...localDbData };
    }
  } else {
    return { ...localDbData };
  }
};

/**
 * Сохранить все данные системы одновременно (например, при сбросе к демо-данным или импорте)
 */
export const saveAllData = async (dataObj) => {
  if (isPgConnected) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (dataObj.users && Array.isArray(dataObj.users)) {
          const map = new Map();
          dataObj.users.forEach(u => {
            const k = u.id || u.login;
            if (k) map.set(k, { ...map.get(k), ...u });
          });
          dataObj.users = Array.from(map.values());
        }
        for (const [key, val] of Object.entries(dataObj)) {
          const query = `
            INSERT INTO pulse_store (key, data, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (key) DO UPDATE
            SET data = $2, updated_at = CURRENT_TIMESTAMP;
          `;
          await client.query(query, [key, JSON.stringify(val)]);
        }
        await client.query('COMMIT');
        // Фоновое обновление локальной копии для бесшовного Failover (3)
        localDbData = {
          tasks: dataObj.tasks || [],
          sprints: dataObj.sprints || [],
          users: dataObj.users || [],
          groups: dataObj.groups || [],
          notifications: dataObj.notifications || []
        };
        saveLocalFile();
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('❌ Ошибка PostgreSQL при сохранении всех данных в транзакции:', err.message);
      isPgConnected = false;
      localDbData = {
        tasks: dataObj.tasks || [],
        sprints: dataObj.sprints || [],
        users: dataObj.users || [],
        groups: dataObj.groups || [],
        notifications: dataObj.notifications || []
      };
      saveLocalFile();
    }
  } else {
    localDbData = {
      tasks: dataObj.tasks || [],
      sprints: dataObj.sprints || [],
      users: dataObj.users || [],
      groups: dataObj.groups || [],
      notifications: dataObj.notifications || []
    };
    saveLocalFile();
  }
};

export const isPostgresMode = () => isPgConnected;
