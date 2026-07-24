const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/telegram_agent.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldCheckTeamCode = \`    let dbTasks: any[] = [];
    let mappedTasks: any[] = [];
    try {
      try {
          await apiClient.get("/omnitask/");
        } catch (err: any) {
          throw err;
        }
    } catch (err) {\`;

const newCheckTeamCode = \`    let dbTasks: any[] = [];
    let mappedTasks: any[] = [];
    try {
      const json = await apiClient.get("/omnitask/") as any;
      dbTasks = json?.data || [];
      
      const allMembers = await getCachedMembers();
      
      dbTasks.forEach((t: any) => {
        if (Array.isArray(t.subTasks)) {
          t.subTasks.forEach((sub: any) => {
            const memberName = allMembers.find((m:any) => m.id === sub.assigneeId)?.fullName || 'Không rõ';
            
            // Map status text (e.g. pending, in_progress, in_review, done)
            let st = 'Pending';
            if (sub.status === 'in_progress') st = 'In Progress';
            else if (sub.status === 'in_review') st = 'In Review';
            else if (sub.status === 'done') st = 'Done';
            else if (sub.status === 'pending') st = 'Pending';
            else st = sub.status;
            
            mappedTasks.push({
              title: sub.title,
              status: st,
              deadline: sub.deadline ? sub.deadline.split('T')[0] : 'Chưa có',
              rawDeadline: sub.deadline ? new Date(sub.deadline) : null,
              assignee: memberName,
              planeTaskId: sub.planeTaskId || 'Task'
            });
          });
        }
      });
    } catch (err) {\`;

content = content.replace(oldCheckTeamCode, newCheckTeamCode);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed check_team logic');
