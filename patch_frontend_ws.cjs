const fs = require('fs');
let code = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

// addTask
code = code.replace(/const addTask = \(newTaskData.*?\) => \{/, 
`$&
    if (activeWorkspaceId && !newTaskData.workspaceId) newTaskData.workspaceId = activeWorkspaceId;`);

// addSprint
code = code.replace(/const addSprint = \(sprintData.*?\) => \{/,
`$&
    if (activeWorkspaceId && !(sprintData as any).workspaceId) (sprintData as any).workspaceId = activeWorkspaceId;`);

// addGroup
code = code.replace(/const addGroup = \(groupData.*?\) => \{/,
`$&
    if (activeWorkspaceId && !(groupData as any).workspaceId) (groupData as any).workspaceId = activeWorkspaceId;`);

// addFinding
code = code.replace(/addFinding: \(findingData\) => \{/,
`$&
          if (activeWorkspaceId && !(findingData as any).workspaceId) (findingData as any).workspaceId = activeWorkspaceId;`);

// activeWorkspaceId localStorage mapping
const lsGetRegex = /const \[activeWorkspaceId, setActiveWorkspaceId\] = useState<string \| null>\(null\);/;
code = code.replace(lsGetRegex, 
`const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem('korpjira-active-workspace') || null;
  });

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem('korpjira-active-workspace', activeWorkspaceId);
    else localStorage.removeItem('korpjira-active-workspace');
  }, [activeWorkspaceId]);`);

fs.writeFileSync('src/context/TaskContext.tsx', code);
