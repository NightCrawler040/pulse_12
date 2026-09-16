import express from 'express';

export default function createFindingsRouter(requireAuth) {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
  res.json(req.dbData.findings || []);
});

  router.post('/', requireAuth, async (req, res) => {
  const findingData = req.body;
  const newId = findingData.id || `fnd-${Date.now()}`;
  const newFinding = {
    ...findingData,
    id: newId,
    source: findingData.source || 'custom',
    status: findingData.status || 'new',
    createdAt: findingData.createdAt || new Date().toISOString()
  };
  if (!req.dbData.findings) req.dbData.findings = [];
  req.dbData.findings.unshift(newFinding);
  try { await req.broadcastUpdate('findings'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.status(201).json(newFinding);
});

  router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (!req.dbData.findings) req.dbData.findings = [];
  req.dbData.findings = req.dbData.findings.map(f => {
    if (f.id === id) {
      return { ...f, ...updates };
    }
    return f;
  });
  try { await req.broadcastUpdate('findings'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!req.dbData.findings) req.dbData.findings = [];
  req.dbData.findings = req.dbData.findings.filter(f => f.id !== id);
  try { await req.broadcastUpdate('findings'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.json({ success: true });
});

  router.post('/:id/promote', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { assigneeId, sprintId, priority } = req.body;
  if (!req.dbData.findings) req.dbData.findings = [];
  const finding = req.dbData.findings.find(f => f.id === id);
  if (!finding) {
    return res.status(404).json({ error: 'Инцидент не найден' });
  }

  let resolvedAssigneeId = assigneeId || null;
  if (!resolvedAssigneeId && finding.assignee) {
    const foundUser = (req.dbData.users || []).find(u => u.login === finding.assignee || u.id === finding.assignee || u.name === finding.assignee);
    resolvedAssigneeId = foundUser ? foundUser.id : finding.assignee;
  }

  const newTaskId = `NEX-${Math.floor(100 + Math.random() * 900)}`;
  const promotedTask = {
    id: newTaskId,
    title: `[${finding.source.toUpperCase()}] ${finding.title}`,
    description: `${finding.description || ''}\n\n🛡️ **Данные инцидента:**\n- **Проект:** ${finding.project || 'Не указано'}\n- **Файл/Расположение:** \`${finding.fileLocation || 'Не указано'}\`\n- **CWE/CVE:** ${finding.cwe || 'N/A'}\n- **Компонент:** ${finding.component || 'N/A'}\n- **Ответственный от сканера:** ${finding.assignee || 'Не назначен'}\n- **Критичность:** ${finding.severity}`,
    status: 'todo',
    priority: priority || (finding.severity === 'Critical' ? 'urgent' : finding.severity === 'High' ? 'high' : 'medium'),
    assigneeId: resolvedAssigneeId,
    sprintId: sprintId || null,
    storyPoints: finding.severity === 'Critical' ? 5 : 3,
    estimatedHours: finding.severity === 'Critical' ? 8 : 4,
    loggedHours: 0,
    subtasks: [],
    comments: [
      {
        id: `c-${Date.now()}`,
        userId: req.currentUser?.id || 'usr-1',
        text: `Инцидент безопасности официально переведен в разработку из Центра ИБ (Source: ${finding.source.toUpperCase()}).`,
        createdAt: new Date().toISOString(),
        isSystemLog: true
      }
    ],
    tags: ['Security', finding.source === 'derscanner' ? 'DerScanner' : finding.source.toUpperCase()],
    externalFindingId: finding.id,
    project: finding.project || 'PULSE',
    fileLocation: finding.fileLocation || 'Не указано',
    cwe: finding.cwe || 'N/A',
    component: finding.component || 'General Security',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!req.dbData.tasks) req.dbData.tasks = [];
  req.dbData.tasks.unshift(promotedTask);

  // Обновляем статус инцидента на promoted и связываем ID
  req.dbData.findings = req.dbData.findings.map(f => {
    if (f.id === id) {
      return { ...f, status: 'promoted', promotedTaskId: newTaskId };
    }
    return f;
  });

  try { await req.broadcastUpdate('tasks'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  try { await req.broadcastUpdate('findings'); } catch (e) { return res.status(500).json({error: 'Database save failed'}); }
  res.status(201).json({ success: true, task: promotedTask, findingId: id });
});

  return router;
}
