const fs = require('fs');
let code = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');

const useMemoHooks = `
  const filteredSprints = useMemo(() => {
    if (!activeWorkspaceId) return sprints;
    return sprints.filter(s => !s.workspaceId || s.workspaceId === activeWorkspaceId);
  }, [sprints, activeWorkspaceId]);

  const filteredGroups = useMemo(() => {
    if (!activeWorkspaceId) return groups;
    return groups.filter(g => !g.workspaceId || g.workspaceId === activeWorkspaceId);
  }, [groups, activeWorkspaceId]);

  const filteredFindings = useMemo(() => {
    if (!activeWorkspaceId) return findings;
    return findings.filter(f => !f.workspaceId || f.workspaceId === activeWorkspaceId);
  }, [findings, activeWorkspaceId]);
`;

code = code.replace(/\/\/ Filtered tasks/, useMemoHooks + '\n  // Filtered tasks');

code = code.replace(/sprints,\s*activeSprintId,/, 'sprints: filteredSprints,\n        activeSprintId,');
code = code.replace(/groups,\s*onlineUserIds,/, 'groups: filteredGroups,\n        onlineUserIds,');
code = code.replace(/findings,\s*apiKeys,/, 'findings: filteredFindings,\n        apiKeys,');

fs.writeFileSync('src/context/TaskContext.tsx', code);
