import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initialUsers, initialSprints, initialTasks, initialGroups, initialFindings, initialApiKeys, initialWorkspaces } from './initialData.js';

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

const defaultLdapSettings = {
  enabled: false,
  serverUrl: '',
  baseDN: '',
  bindDN: '',
  bindPassword: '',
  userFilter: '',
  loginAttribute: '',
  emailAttribute: '',
  nameAttribute: '',
  departmentAttribute: '',
  objectClassUsers: '',
  ignoreCase: true,
  domainName: ''
};

const defaultFortigateSettings = {
  enabled: true,
  autoBanEnabled: true,
  banUrl: 'https://172.31.69.30:10443/api/v2/monitor/system/automation-stitch/webhook/Pulse12%20API',
  unbanUrl: '',
  apiToken: '5sj1c9Ns79s419x5856xyrn4x8dwcd',
  banDurationDays: 90,
  addressGroup: 'Pulse_Banned_IPs'
};

// Локальное файловое хранилище (для Fallback-режима без Docker/Postgres)
let localDbData = {
          tasks: dataObj.tasks || [],
          sprints: dataObj.sprints || [],
          users: dataObj.users || [],
          groups: dataObj.groups || [],
          notifications: dataObj.notifications || [],
          findings: dataObj.findings || [],
          api_keys: dataObj.api_keys || [],
          ldap_settings: dataObj.ldap_settings || { ...defaultLdapSettings },
          globalSettings: dataObj.globalSettings || {},
          workspaces: dataObj.workspaces || [],
          imapSettings: dataObj.imapSettings || {},
          processedEmails: dataObj.processedEmails || [],
          kataHashes: dataObj.kataHashes || []
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
          notifications: dataObj.notifications || [],
          findings: dataObj.findings || [],
          api_keys: dataObj.api_keys || [],
          ldap_settings: dataObj.ldap_settings || { ...defaultLdapSettings },
          globalSettings: dataObj.globalSettings || {},
          workspaces: dataObj.workspaces || [],
          imapSettings: dataObj.imapSettings || {},
          processedEmails: dataObj.processedEmails || [],
          kataHashes: dataObj.kataHashes || []
        };
      saveLocalFile();
    }
  } else {
    localDbData = {
          tasks: dataObj.tasks || [],
          sprints: dataObj.sprints || [],
          users: dataObj.users || [],
          groups: dataObj.groups || [],
          notifications: dataObj.notifications || [],
          findings: dataObj.findings || [],
          api_keys: dataObj.api_keys || [],
          ldap_settings: dataObj.ldap_settings || { ...defaultLdapSettings },
          globalSettings: dataObj.globalSettings || {},
          workspaces: dataObj.workspaces || [],
          imapSettings: dataObj.imapSettings || {},
          processedEmails: dataObj.processedEmails || [],
          kataHashes: dataObj.kataHashes || []
        };
    saveLocalFile();
  }
  } finally {
    dbMutex.unlock();
  }
};

export const isPostgresMode = () => isPgConnected;
