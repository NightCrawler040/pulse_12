const fs = require('fs');
let code = fs.readFileSync('server/db.js', 'utf8');

// Fix localDbData init
code = code.replace(/let localDbData = \{[\s\S]*?notificationEvents: \{\}\r?\n\};\r?\n/, 
`let localDbData = {
  tasks: [],
  sprints: [],
  users: [],
  groups: [],
  notifications: [],
  findings: [],
  api_keys: [],
  ldap_settings: { ...defaultLdapSettings },
  mailSettings: {},
  fortigateSettings: { ...defaultFortigateSettings },
  bannedIps: [],
  notificationEvents: {},
  globalSettings: {},
  workspaces: [],
  imapSettings: {},
  processedEmails: [],
  kataHashes: []
};\n`);

// Fix getAllData result
code = code.replace(/const result = \{[\s\S]*?processedEmails: \[\]\r?\n\s*\};/, 
`const result = {
        tasks: [],
        sprints: [],
        users: [],
        groups: [],
        notifications: [],
        findings: [],
        api_keys: [],
        ldap_settings: { ...defaultLdapSettings },
        mailSettings: resMail.rows.length > 0 ? resMail.rows[0].data : {},
        notificationEvents: resNotif.rows.length > 0 ? resNotif.rows[0].data : {},
        fortigateSettings: { ...defaultFortigateSettings },
        bannedIps: [],
        imapSettings: {},
        processedEmails: [],
        globalSettings: {},
        workspaces: [],
        kataHashes: []
      };`);

// Fix saveAllData localDbData assignments
code = code.replace(/localDbData = \{[\s\S]*?ldap_settings: dataObj\.ldap_settings \|\| \{ \.\.\.defaultLdapSettings \}\r?\n\s*\};/g, 
`localDbData = {
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
        };`);

fs.writeFileSync('server/db.js', code);
