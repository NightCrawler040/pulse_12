const fs = require('fs');
let p = 'src/context/TaskContext.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/workspaces: Workspace\[\];/, "workspaces: Workspace[];\n  activeWorkspaceId: string | null;\n  setActiveWorkspaceId: (id: string | null) => void;");

c = c.replace(/const \[workspaces, setWorkspaces\] = useState<Workspace\[\]>\(\[\]\);/, "const [workspaces, setWorkspaces] = useState<Workspace[]>([]);\n  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);");

c = c.replace(/const filteredTasks = useMemo\(\(\) => \{\n    return tasks.filter\(task => \{/, "const filteredTasks = useMemo(() => {\n    let baseTasks = tasks;\n    if (activeWorkspaceId) {\n      baseTasks = tasks.filter(t => t.workspaceId === activeWorkspaceId || t.workspaceId === 'WS-1');\n    }\n    return baseTasks.filter(task => {");

const eff = `
  // Auto-select workspace on load
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspaceId) {
       const currentUserStr = localStorage.getItem('pulse12_login');
       if (currentUserStr && users) {
          const cu = users.find(u => u.login === currentUserStr);
          if (cu && cu.workspaceIds && cu.workspaceIds.length > 0) {
             setActiveWorkspaceId(cu.workspaceIds[0]);
             return;
          }
       }
       setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId, users]);

  return (
    <TaskContext.Provider value={{
      activeWorkspaceId,
      setActiveWorkspaceId,
`;

c = c.replace(/return \(\n    <TaskContext\.Provider value=\{\{/, eff);

fs.writeFileSync(p, c);
console.log('Success');
