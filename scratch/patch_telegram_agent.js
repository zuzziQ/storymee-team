const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/telegram_agent.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Patch 1: Safe email toLowerCase in admin check (first occurrence)
content = content.replace(
/adminEmails\.includes\(targetMem\.email\.toLowerCase\(\)\)/g,
'adminEmails.includes((targetMem.email || "").toLowerCase())'
);

// Patch 2: Make sure allMembers.find is safe in check_team
content = content.replace(
/const memberName = allMembers\.find\(\(m:any\) => m\.id === sub\.assigneeId\)\?\.fullName \|\| 'Không rõ';/g,
"const memberName = (allMembers || []).find((m:any) => m.id === sub.assigneeId)?.fullName || 'Không rõ';"
);

// Patch 3: In checkRealtimeOverdueDeadlines
content = content.replace(
/const member = members\.find\(\(m: any\) => m\.id === sub\.assigneeId\);/g,
"const member = (members || []).find((m: any) => m.id === sub.assigneeId);"
);

// Patch 4: In getCachedMembers(), what if API returns json directly as array?
// Wait, if json is the array itself (e.g. some APIs don't wrap in { status: 'success', data: [...] })
// Let's make it robust!
content = content.replace(
`    const json = await apiClient.get("/omnitask/team-members") as any;
    if (json && Array.isArray(json.data)) {
      const now = Date.now();
      membersCache = { data: json.data, timestamp: now };
      return json.data;
    }`,
`    const json = await apiClient.get("/omnitask/team-members") as any;
    const dataArr = Array.isArray(json) ? json : (json?.data || []);
    if (Array.isArray(dataArr)) {
      const now = Date.now();
      membersCache = { data: dataArr, timestamp: now };
      return dataArr;
    }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched telegram_agent.ts');
