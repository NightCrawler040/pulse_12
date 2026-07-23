const { Pool } = require("pg");
const pool = new Pool({ connectionString: "postgresql://pulse12_admin:Pulse2026SecureDBPass@localhost:5432/pulse12" });
async function test() {
  try {
    const res = await pool.query("INSERT INTO mail_settings (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1", [JSON.stringify({host: "test"})]);
    console.log("SUCCESS:", res.rowCount);
  } catch (e) {
    console.error("ERROR:", e.message);
  } finally {
    pool.end();
  }
}
test();
