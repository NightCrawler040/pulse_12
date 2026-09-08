const fs = require('fs');

let c = fs.readFileSync('src/components/AdminPanel/FortigateSettingsTab.tsx', 'utf8');

// I will just remove the table section from FortigateSettingsTab.tsx manually using string manipulation
let stripped = c.split('<h3 className="admin-card-title" style={{ margin: 0 }}>Индикаторы компрометации (Заблокированные IP)</h3>')[0];
stripped = stripped + '</div></div>);};';

fs.writeFileSync('src/components/AdminPanel/FortigateSettingsTab.tsx', stripped);
console.log('Stripped FortigateSettingsTab');
