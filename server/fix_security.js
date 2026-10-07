import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

// Add state
code = code.replace(
  'const [isPromoting, setIsPromoting] = useState<boolean>(false);',
  'const [isPromoting, setIsPromoting] = useState<boolean>(false);\n  const [selectedFindings, setSelectedFindings] = useState<string[]>([]);'
);

// Clear selection when filters change
code = code.replace(
  'const filteredFindings = currentSystemFindings.filter(f => {',
  `// Clear selection when tabs change (handled implicitly by UI, but good practice)
  const filteredFindings = currentSystemFindings.filter(f => {`
);

// Add bulk actions
const bulkUI = `
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: 'hsl(var(--card-bg))', padding: '12px 16px', borderRadius: '12px', border: '1px solid hsl(var(--border-color))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input 
            type="checkbox" 
            checked={filteredFindings.length > 0 && selectedFindings.length === filteredFindings.length}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedFindings(filteredFindings.map(f => f.id));
              } else {
                setSelectedFindings([]);
              }
            }}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>Выбрать все инциденты на текущей вкладке</span>
        </div>
        
        {selectedFindings.length > 0 && isAdmin && (
          <button 
            className="btn-primary" 
            style={{ background: '#ef4444', color: 'white', border: 'none' }}
            onClick={() => {
              if (window.confirm(\`Вы уверены, что хотите безвозвратно удалить \${selectedFindings.length} выбранных инцидентов?\`)) {
                selectedFindings.forEach(id => deleteFinding(id));
                setSelectedFindings([]);
              }
            }}
          >
            🗑️ Удалить выбранные ({selectedFindings.length})
          </button>
        )}
      </div>

      <div className="findings-list">`;

code = code.replace('<div className="findings-list">', bulkUI);

// Add individual checkboxes
const checkboxUI = `<div className="finding-title-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedFindings.includes(finding.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFindings(prev => [...prev, finding.id]);
                      } else {
                        setSelectedFindings(prev => prev.filter(id => id !== finding.id));
                      }
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div className="finding-title" style={{ margin: 0 }}>`;

code = code.replace(
  '<div className="finding-title-section">\n                <div className="finding-title">',
  checkboxUI
);

// Close the wrapper div
code = code.replace(
  /<\/code>\n                  \)}\n                <\/div>/g,
  `</code>\n                  )}\n                </div>\n                </div>`
);

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
console.log('Fixed SecurityCenter');
