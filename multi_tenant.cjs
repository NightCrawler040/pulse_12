const fs = require('fs');
let code = fs.readFileSync('server/index.js', 'utf8');

// 1. Return multiple projects instead of just PULSE
const projectsCode = `const handleJiraProjects = (req, res) => {
  const url = req.originalUrl || req.url || req.path || '';
  const list = [
    getProjectObject(req, 'PULSE', 'Pulse Shared (Visible to All)'),
    getProjectObject(req, 'SEC', 'Pulse Security Dept (Restricted)'),
    getProjectObject(req, 'IT', 'Pulse IT Dept (Restricted)'),
    getProjectObject(req, 'DEV', 'Pulse Development Dept (Restricted)')
  ];
  if (url.includes('/project/search') || url.includes('/project?')) {
    return res.status(200).json({ maxResults: 50, startAt: 0, total: list.length, isLast: true, values: list, projects: list });
  }
  return res.status(200).json(list);
};`;

code = code.replace(/const handleJiraProjects = \(req, res\) => \{[\s\S]*?return res\.status\(200\)\.json\(list\);\r?\n\};/, projectsCode);

// 2. Modify getProjectObject to support name argument
const getProjectObjRegex = /const getProjectObject = \(req, pOrKey\) => \{[\s\S]*?const pName = p \? p\.name : 'Pulse Corporate Security & Dev Project';/;
const getProjectObjReplace = `const getProjectObject = (req, pOrKey, customName) => {
  const p = typeof pOrKey === 'string' ? { key: pOrKey, id: pOrKey } : pOrKey;
  const pKey = p ? (p.key || 'PULSE').toUpperCase() : 'PULSE';
  const pId = p ? String(p.id || '10001') : '10001';
  const pName = customName || (p ? p.name : 'Pulse Corporate Security & Dev Project');`;

code = code.replace(getProjectObjRegex, getProjectObjReplace);

// 3. Map project to allowedDepartments in handleJiraCreateIssue
const createIssueRegex = /allowedDepartments: \['all'\],/;
const createIssueReplace = `allowedDepartments: projectKey === 'SEC' ? ['Security'] : projectKey === 'IT' ? ['IT'] : projectKey === 'DEV' ? ['Development', 'Engineering'] : ['all'],`;

code = code.replace(createIssueRegex, createIssueReplace);

fs.writeFileSync('server/index.js', code);
console.log('Backend updated for multi-tenant projects');
