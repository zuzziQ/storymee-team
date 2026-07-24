const fs = require('fs');
const agentFile = 'src/telegram_agent.ts';
let agentCode = fs.readFileSync(agentFile, 'utf8');
agentCode = agentCode.replace(
  '{ command: "check_all", description: "Báo cáo trạng thái toàn bộ nhân viên" }',
  '{ command: "check_all", description: "Báo cáo trạng thái toàn bộ nhân viên" },\n          { command: "team_status", description: "Báo cáo chấm công hôm nay" },\n          { command: "subtask", description: "Phân rã task bằng AI" }'
);
fs.writeFileSync(agentFile, agentCode);
