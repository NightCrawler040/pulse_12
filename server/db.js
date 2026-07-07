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

// Настройка подключения к PostgreSQL
const connectionString = process.env.DATABASE_URL || 'postgresql://pulse12_admin:corporate_secret_password@localhost:5432/pulse12';
const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 3000,
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
          tasks: parsed.tasks || [],
          sprints: parsed.sprints || initialSprints,
          users: parsed.users || initialUsers,
          groups: parsed.groups || initialGroups,
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

const saveLocalFile = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(localDbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Ошибка сохранения в db.json:', err);
  }
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
      console.log(`✅ В PostgreSQL найдено ${count} коллекций данных. Система готова к работе.`);
    }

    client.release();
  } catch (err) {
    console.warn(`⚠️ PostgreSQL недоступен (${err.message}). Переключение на локальный файловый режим (db.json)...`);
    isPgConnected = false;
    loadLocalFile();
  }
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
  if (isPgConnected) {
    try {
      const query = `
        INSERT INTO pulse_store (key, data, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE
        SET data = $2, updated_at = CURRENT_TIMESTAMP;
      `;
      await pool.query(query, [key, JSON.stringify(dataArray)]);
    } catch (err) {
      console.error(`❌ Ошибка PostgreSQL при сохранении коллекции "${key}":`, err.message);
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
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('❌ Ошибка PostgreSQL при сохранении всех данных в транзакции:', err.message);
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
