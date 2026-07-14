const fs = require('fs');
const file = '/Users/imam/storymee/1-Harness-Apps/StorymeeTeam/src/app/features/kanban/KanbanTab.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`  onArchiveTaskDirect: (task: Task) => void;
  handleUpdateTaskStatus?: (id: string, status: string) => void;
  handleCreateTask?: (title: string, assignee: string, estimate: number, priority: any, status?: string) => void;
  teamMembers: TeamMember[];
}`,
`  onArchiveTaskDirect: (task: Task) => void;
  onRequestArchive: (task: Task) => void;
  handleUpdateTaskStatus?: (id: string, status: string) => void;
  handleCreateTask?: (title: string, assignee: string, estimate: number, priority: any, status?: string) => Promise<void> | void;
  teamMembers: TeamMember[];
}`);

fs.writeFileSync(file, content);
console.log('Fixed KanbanTabProps');
