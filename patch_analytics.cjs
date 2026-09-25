const fs = require('fs');
let code = fs.readFileSync('src/components/Analytics/Analytics.tsx', 'utf8');

code = code.replace(/const \{ tasks, users, groups, activeSprintId, filters \} = useTaskContext\(\);/,
  "const { filteredTasks, users, groups, activeSprintId, filters } = useTaskContext();\n  const tasks = filteredTasks; // Bug #6 Fix: map tasks to filteredTasks for all calculations");

fs.writeFileSync('src/components/Analytics/Analytics.tsx', code);
