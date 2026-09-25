const fs = require('fs');
let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

// Add systemTab state
code = code.replace(/<button\s*className=\{\`filter-btn \$\{systemTab === 'fortigate' \? 'active' : ''\}\`\}/,
`          <button
            className={\`filter-btn \${systemTab === 'hr_orders' ? 'active' : ''}\`}
            onClick={() => setSystemTab('hr_orders')}
            style={{ background: systemTab === 'hr_orders' ? '#f59e0b' : undefined, color: systemTab === 'hr_orders' ? 'white' : undefined, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            📋 HR Приказы (JML)
          </button>
          $&`);

code = code.replace(/const \[systemTab, setSystemTab\] = useState<'all' \| 'derscanner' \| 'fortigate'>\('all'\);/,
  "const [systemTab, setSystemTab] = useState<'all' | 'derscanner' | 'fortigate' | 'hr_orders'>('all');");

// Render conditionally
const renderContent = `
        {systemTab === 'hr_orders' ? (
          <HrOrdersDashboard />
        ) : (
          <>
            <div className="security-filters-bar">
`;
code = code.replace(/<div className="security-filters-bar">/, renderContent);

const endRenderContent = `
          </>
        )}
      {/* Modal for Promoting Finding to Task */}
`;
code = code.replace(/\{(\/\* Modal for Promoting Finding to Task \*\/)\}/, endRenderContent.replace('/*', '').replace('*/', '') + '\n      {$1}');


// Add HrOrdersDashboard component import at top
code = "import { HrOrdersDashboard } from './HrOrdersDashboard';\n" + code;

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
