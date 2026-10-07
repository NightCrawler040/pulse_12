import fs from 'fs';

let code = fs.readFileSync('src/components/SecurityCenter/SecurityCenter.tsx', 'utf8');

// Replace the ternary start to include a fragment
code = code.replace(
  `) : systemTab === "fortigate" ? <FortigateTable /> : (
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: 'hsl(var(--card-bg))', padding: '12px 16px', borderRadius: '12px', border: '1px solid hsl(var(--border-color))' }}>`,
  `) : systemTab === "fortigate" ? <FortigateTable /> : (
      <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', background: 'hsl(var(--card-bg))', padding: '12px 16px', borderRadius: '12px', border: '1px solid hsl(var(--border-color))' }}>`
);

// Add the closing fragment at the end of findings-list
code = code.replace(
  `          </div>
        )}
      </div>
      )}`,
  `          </div>
        )}
      </div>
      </>
      )}`
);

fs.writeFileSync('src/components/SecurityCenter/SecurityCenter.tsx', code);
console.log('Fixed JSX Fragment Syntax');
