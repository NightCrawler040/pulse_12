const { Client } = require('pg');

const client = new Client({
  user: 'pulse12_admin',
  password: 'Pulse2026SecureDBPass',
  host: '127.0.0.1',
  port: 5432,
  database: 'pulse12'
});

async function migrate() {
  await client.connect();

  // 1. Insert Workspaces if not exists
  const initialWorkspaces = [
    {
      id: 'WS-1',
      name: 'Security & Engineering',
      ownerId: 'usr-1',
      adGroup: 'Engineering',
      enabledModules: ['kanban', 'security_center', 'integrations'],
      createdAt: new Date().toISOString()
    }
  ];
  await client.query("INSERT INTO pulse_store (key, data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", ['workspaces', JSON.stringify(initialWorkspaces)]);

  // 2. Migrate Tasks
  const resTasks = await client.query("SELECT data FROM pulse_store WHERE key = 'tasks'");
  if (resTasks.rows.length > 0) {
    let tasks = resTasks.rows[0].data;
    tasks = tasks.map(t => {
      if (!t.workspaceId) t.workspaceId = 'WS-1';
      return t;
    });
    await client.query("UPDATE pulse_store SET data = $1 WHERE key = 'tasks'", [JSON.stringify(tasks)]);
    console.log("Migrated tasks");
  }

  // 3. Migrate Findings
  const resFindings = await client.query("SELECT data FROM pulse_store WHERE key = 'findings'");
  if (resFindings.rows.length > 0) {
    let findings = resFindings.rows[0].data;
    findings = findings.map(f => {
      if (!f.workspaceId) f.workspaceId = 'WS-1';
      return f;
    });
    await client.query("UPDATE pulse_store SET data = $1 WHERE key = 'findings'", [JSON.stringify(findings)]);
    console.log("Migrated findings");
  }

  await client.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
