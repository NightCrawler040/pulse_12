const fs = require('fs');

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

const target1 = '<div className="findings-list">';
const replace1 = '{systemTab === "fortigate" ? <FortigateTable /> : <div className="findings-list">';

const target2 = `        {filteredFindings.length === 0 && (`;
const replace2 = `        {filteredFindings.length === 0 && systemTab !== "fortigate" && (`;

code = code.replace(target1, replace1);
code = code.replace(target2, replace2);

// and we need to close the ternary we opened with replace1.
// We opened it right before <div className="findings-list">.
// The findings-list div closes right before the filteredFindings.length === 0 check.
// Actually, it doesn't close there? Let's check where it closes.
// Wait, the ternary is `{systemTab === 'fortigate' ? <FortigateTable /> : <div className="findings-list"> ... </div> }`

code = code.replace('</div>\n\n        {filteredFindings.length === 0', '</div>\n        }\n\n        {filteredFindings.length === 0');

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
console.log('Fixed rendering logic');
