import fs from 'fs';

// 1. Fix TaskContext.tsx to pass newId to apiService
let taskContextCode = fs.readFileSync('src/context/TaskContext.tsx', 'utf8');
taskContextCode = taskContextCode.replace(
  "const newSprint: Sprint = { ...sprintData, id: newId };\n    setSprints(prev => [...prev, newSprint]);\n    apiService.createSprint(sprintData)",
  "const newSprint: Sprint = { ...sprintData, id: newId };\n    setSprints(prev => [...prev, newSprint]);\n    apiService.createSprint(newSprint)"
);
fs.writeFileSync('src/context/TaskContext.tsx', taskContextCode);

// 2. Fix Backlog.tsx to pass activeWorkspaceId
let backlogCode = fs.readFileSync('src/components/Backlog/Backlog.tsx', 'utf8');
backlogCode = backlogCode.replace(
  `      addSprint({
        name: sprintName,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
        goal: sprintGoal,
        isActive: sprintIsActive
      });`,
  `      addSprint({
        name: sprintName,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
        goal: sprintGoal,
        isActive: sprintIsActive,
        workspaceId: activeWorkspaceId || undefined
      });`
);
fs.writeFileSync('src/components/Backlog/Backlog.tsx', backlogCode);

console.log('Fixed Sprint creation IDs and Workspace binding.');
