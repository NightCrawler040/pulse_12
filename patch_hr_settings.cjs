const fs = require('fs');

// 1. Backend settings route
let settingsCode = fs.readFileSync('server/routes/settings.js', 'utf8');
if (!settingsCode.includes('/hr')) {
  settingsCode = settingsCode.replace(/return router;/, `
  router.get('/hr', requireAdmin, async (req, res) => {
    res.json({ hrSettings: req.dbData.hrSettings || { workspaceId: 'WS-1', groupId: null } });
  });

  router.post('/hr', requireAdmin, async (req, res) => {
    try {
      const { hrSettings } = req.body;
      req.dbData.hrSettings = hrSettings;
      await saveCollection('hrSettings', hrSettings);
      res.json({ success: true, message: 'Настройки HR Приказов сохранены' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;`);
  fs.writeFileSync('server/routes/settings.js', settingsCode);
}

// 2. AdminPanel UI patch
let adminPanel = fs.readFileSync('src/components/AdminPanel/AdminPanel.tsx', 'utf8');

// Add HrSettingsTab import if needed
if (!adminPanel.includes('HrOrdersSettingsTab')) {
  adminPanel = adminPanel.replace(/import FortigateSettingsTab from '\.\/FortigateSettingsTab';/, 
    "import FortigateSettingsTab from './FortigateSettingsTab';\nimport HrOrdersSettingsTab from './HrOrdersSettingsTab';");
}

// Add the Tab button
if (!adminPanel.includes("activeTab === 'hr-orders'")) {
  adminPanel = adminPanel.replace(/<button \s*className=\{`admin-tab-btn \$\{activeTab === 'fortigate' \? 'active' : ''\}`\}\s*onClick=\{\(\) => setActiveTab\('fortigate'\)\}\s*>\s*🛡️ FortiGate \(SOAR\)\s*<\/button>/,
    `<button 
                className={\`admin-tab-btn \${activeTab === 'fortigate' ? 'active' : ''}\`}
                onClick={() => setActiveTab('fortigate')}
              >
                🛡️ FortiGate (SOAR)
              </button>
              <button 
                className={\`admin-tab-btn \${activeTab === 'hr-orders' ? 'active' : ''}\`}
                onClick={() => setActiveTab('hr-orders')}
              >
                📋 HR Приказы (JML)
              </button>`);
}

// Render the Tab component
if (!adminPanel.includes("<HrOrdersSettingsTab />")) {
  adminPanel = adminPanel.replace(/\{activeTab === 'fortigate' && \(\s*<FortigateSettingsTab workspaceId=\{selectedIntegrationWsId\}  \/>\s*\)\}/,
    `{activeTab === 'fortigate' && (
          <FortigateSettingsTab workspaceId={selectedIntegrationWsId}  />
        )}
        
        {activeTab === 'hr-orders' && (
          <HrOrdersSettingsTab />
        )}`);
}

fs.writeFileSync('src/components/AdminPanel/AdminPanel.tsx', adminPanel);
