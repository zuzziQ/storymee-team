const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/telegram_agent.ts');
let content = fs.readFileSync(filePath, 'utf8');

// First instance at line ~1328
content = content.replace(
`  try {
    const membersRes = await getCachedMembersMockResponse();
    if (membersRes.ok) {
      const membersData = (await membersRes.json()) as any;
      if (membersData.status === 'success' && Array.isArray(membersData.data)) {
        allMembers = membersData.data;
        allMembers = membersData.data;
        const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
        member = allMembers.find((m: any) => {
          const cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
          return cleanDB === cleanUsername;
        });
      }
    }
  } catch (err) {`,
`  try {
    allMembers = await getCachedMembers();
    if (allMembers && allMembers.length > 0) {
      const cleanUsername = (username || "").replace(/^@/, "").toLowerCase().trim();
      member = allMembers.find((m: any) => {
        const cleanDB = (m.telegramUsername || "").replace(/^@/, "").toLowerCase().trim();
        return cleanDB === cleanUsername;
      });
    }
  } catch (err) {`
);

// Second instance at line ~1957
content = content.replace(
`        try {
          const membersRes = await getCachedMembersMockResponse();
          if (membersRes.ok) {
            const data = await membersRes.json() as any;
            const adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
            for (const targetMem of (data.data || [])) {`,
`        try {
          const allMems = await getCachedMembers();
          if (allMems && allMems.length > 0) {
            const adminEmails = ['kimngan151091@gmail.com', 'lehuyducanh.vn@gmail.com', 'zuzzivn@gmail.com'];
            for (const targetMem of allMems) {`
);

// Also fix the corresponding closing braces for the second instance if needed
// Actually, it's safer to just replace it and let `tsc` tell us if we missed braces.
// But wait, the second replace replaces 5 lines with 4 lines. It should be fine as long as braces match.

fs.writeFileSync(filePath, content, 'utf8');
console.log('Refactored getCachedMembersMockResponse usages 2.');
