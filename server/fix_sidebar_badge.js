import fs from 'fs';

let sidebarCode = fs.readFileSync('src/components/Sidebar/Sidebar.tsx', 'utf8');

// Replace the activeFindingsCount logic
sidebarCode = sidebarCode.replace(
  `const activeFindingsCount = findings.filter(f => f.status === 'new' || f.status === 'analyzing').length;`,
  `  const canAccessSystem = (source: string) => {
    if (isAdmin || !currentUser) return true;
    const userDept = currentUser.department || '';
    if (source === 'derscanner') {
      return ['Engineering', 'Security', 'QA Engineering', 'Product & Agile', 'Инженерный', 'Разработка', 'Кибербезопасность'].some(d => userDept.includes(d) || d.includes(userDept));
    }
    return true;
  };
  
  const activeFindingsCount = findings.filter(f => 
    (f.status === 'new' || f.status === 'analyzing') && canAccessSystem(f.source || '')
  ).length;`
);

fs.writeFileSync('src/components/Sidebar/Sidebar.tsx', sidebarCode);
console.log('Fixed Sidebar badge leaking.');
