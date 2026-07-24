const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/telegram_agent.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
`  try {
    const json = await apiClient.get("/omnitask/team-members") as any;
    if (json && json.status === 'success' && Array.isArray(json.data)) {
      const now = Date.now();
      membersCache = { data: json.data, timestamp: now };
      return json.data;
    }
  } catch (err) {
    console.error("Lỗi fetch team-members:", err);
  }`,
`  try {
    const json = await apiClient.get("/omnitask/team-members") as any;
    if (json && Array.isArray(json.data)) {
      const now = Date.now();
      membersCache = { data: json.data, timestamp: now };
      return json.data;
    }
  } catch (err) {
    console.error("Lỗi fetch team-members:", err);
  }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Cleaned getCachedMembers');
