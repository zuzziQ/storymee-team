const fs = require('fs');
const path = require('path');

const toolsDir = '/Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/src/mcp/tools';

const files = ['taskTools.ts', 'hrTools.ts', 'attendanceTools.ts'];

for (const f of files) {
  const fp = path.join(toolsDir, f);
  let code = fs.readFileSync(fp, 'utf8');
  
  // Add API_ROUTES import
  code = code.replace(
    'import { CoreApiClient } from "@storymee/api-client";',
    'import { CoreApiClient, API_ROUTES } from "@storymee/api-client";'
  );
  
  // Fetch members inside the wrapper
  code = code.replace(
    /switch \(name\) \{/,
    `let data;
  try {
    data = (await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS)) as any;
  } catch (err: any) {
    throw new McpError(ErrorCode.InternalError, "Không thể kết nối đến Core API Service để lấy danh sách thành viên.");
  }
  const members = data.data || [];

  switch (name) {`
  );
  
  fs.writeFileSync(fp, code, 'utf8');
}
console.log("Fixed tools!");
