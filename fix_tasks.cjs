const fs = require('fs');

let code = fs.readFileSync('server/routes/tasks.js', 'utf8');

// Fix duplicate id in PUT
code = code.replace(/    const \{ id \} = req\.params;\s+const existingTask = \(req\.dbData\.tasks \|\| \[\]\)\.find\(t => t\.id === id\);\s+if \(!existingTask\) return res\.status\(404\)\.json\(\{ error: 'Task not found' \}\);\s+if \(req\.currentUser\.roleType !== 'admin'\) \{\s+if \(existingTask\.workspaceId && !\(req\.currentUser\.workspaceIds \|\| \[\]\)\.includes\(existingTask\.workspaceId\)\) \{\s+return res\.status\(403\)\.json\(\{ error: '.*? workspace' \}\);\s+\}\s+\}\s+const \{ id \} = req\.params;/g, 
`    const { id } = req.params;
    const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });
    if (req.currentUser.roleType !== 'admin') {
      if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к редактированию задачи из этого workspace' });
      }
    }`);

// Fix duplicate existingTask
code = code.replace(/    const existingTask = \(req\.dbData\.tasks \|\| \[\]\)\.find\(t => t\.id === id\);\s+if \(!existingTask\) \{\s+return res\.status\(404\)\.json\(\{ error: '.*?' \}\);\s+\}/g, '');

// Fix duplicate id in DELETE
code = code.replace(/    const \{ id \} = req\.params;\s+const existingTask = \(req\.dbData\.tasks \|\| \[\]\)\.find\(t => t\.id === id\);\s+if \(!existingTask\) return res\.status\(404\)\.json\(\{ error: 'Task not found' \}\);\s+if \(req\.currentUser\.roleType !== 'admin'\) \{\s+if \(existingTask\.workspaceId && !\(req\.currentUser\.workspaceIds \|\| \[\]\)\.includes\(existingTask\.workspaceId\)\) \{\s+return res\.status\(403\)\.json\(\{ error: '.*? workspace' \}\);\s+\}\s+\}\s+const \{ id \} = req\.params;/g,
`    const { id } = req.params;
    const existingTask = (req.dbData.tasks || []).find(t => t.id === id);
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });
    if (req.currentUser.roleType !== 'admin') {
      if (existingTask.workspaceId && !(req.currentUser.workspaceIds || []).includes(existingTask.workspaceId)) {
        return res.status(403).json({ error: 'Нет доступа к удалению задачи из этого workspace' });
      }
    }`);

fs.writeFileSync('server/routes/tasks.js', code);
