const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/pulse12' });
pool.query("SELECT data FROM pulse_store WHERE key = 'bannedIps'").then(r => {
  console.log(JSON.stringify(r.rows[0].data, null, 2));
  pool.end();
}).catch(console.log);
