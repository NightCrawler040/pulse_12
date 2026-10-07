import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://pulse12_admin:Pulse2026SecureDBPass@postgres_db:5432/pulse12';

const unlockUsers = async () => {
  console.log('🔓 Снятие блокировки со всех аккаунтов (brute-force unlock)...');
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT data FROM pulse_store WHERE key='users'");
    if (res.rows.length > 0) {
      let users = res.rows[0].data;
      if (typeof users === 'string') users = JSON.parse(users);
      
      let modified = false;
      users.forEach(u => {
        if (u.lockedUntil || u.loginAttempts) {
          u.lockedUntil = null;
          u.loginAttempts = 0;
          modified = true;
          console.log(`✅ Разблокирован пользователь: ${u.email || u.login || u.id}`);
        }
      });
      
      if (modified) {
        await client.query("UPDATE pulse_store SET data=$1 WHERE key='users'", [JSON.stringify(users)]);
        console.log('🎉 Все пользователи успешно разблокированы в БД!');
      } else {
        console.log('Нет заблокированных пользователей.');
      }
    }
  } catch (err) {
    console.error('❌ Ошибка:', err);
  } finally {
    await client.end();
  }
};

unlockUsers();
