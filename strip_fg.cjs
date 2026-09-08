const fs = require('fs');

let c = fs.readFileSync('src/components/AdminPanel/FortigateSettingsTab.tsx', 'utf8');

// The file has a lot of things. It's better to just rewrite it cleanly or use a regex to strip the table.
// Wait, I can just replace everything from <h3 className="admin-card-title">... (Индикаторы компрометации)... to the end of the file.

const parts = c.split('<h3 className="admin-card-title" style={{ margin: 0 }}>Индикаторы компрометации (Заблокированные IP)</h3>');
if (parts.length === 2) {
  // we want to close the divs properly
  // The first part ends with:
  // </div>
  // 
  // <h3 ...
  c = parts[0] + '</div></div>); };';
}

fs.writeFileSync('src/components/AdminPanel/FortigateSettingsTab.tsx', c);
console.log('FortigateSettingsTab.tsx table stripped');
