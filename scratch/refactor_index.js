const { Project, SyntaxKind } = require("ts-morph");
const fs = require('fs');
const path = require('path');

const project = new Project();
project.addSourceFilesAtPaths("/Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/src/**/*.ts");

const sourceFile = project.getSourceFileOrThrow("index.ts");
const executeMcpTool = sourceFile.getFunction("executeMcpTool");

const switchStatement = executeMcpTool.getDescendantsOfKind(SyntaxKind.SwitchStatement)[0];
const clauses = switchStatement.getCaseBlock().getClauses();

const taskTools = ['get_my_tasks', 'create_task', 'update_task', 'update_task_status', 'assign_task', 'breakdown_task', 'update_subtasks', 'request_task_approval', 'approve_task_request', 'get_task_details'];
const hrTools = ['submit_leave_request', 'get_leave_allowance', 'get_my_payroll_slip', 'update_personal_info', 'upsert_team_member'];
const attendanceTools = ['check_in_out', 'get_attendance_report'];

let taskCode = '';
let hrCode = '';
let attendanceCode = '';

for (const clause of clauses) {
  if (clause.getKind() === SyntaxKind.CaseClause) {
    const expr = clause.getExpression().getText().replace(/['"]/g, '');
    const code = clause.getText();
    if (taskTools.includes(expr)) taskCode += code + '\n';
    else if (hrTools.includes(expr)) hrCode += code + '\n';
    else if (attendanceTools.includes(expr)) attendanceCode += code + '\n';
  }
}

const toolsDir = '/Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/src/mcp/tools';
if (!fs.existsSync(toolsDir)) {
  fs.mkdirSync(toolsDir, { recursive: true });
}

function wrapCode(funcName, code) {
  return `import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CoreApiClient } from "@storymee/api-client";
import { fetchAxios } from "../../fetchAxios";

export async function ${funcName}(name: string, args: any, user: any, isBoss: boolean, apiClient: CoreApiClient): Promise<{ content: Array<{ type: string; text: string }> }> {
  switch (name) {
${code}
    default:
      throw new McpError(ErrorCode.MethodNotFound, \`Công cụ task \${name} chưa được hỗ trợ\`);
  }
}
`;
}

fs.writeFileSync(path.join(toolsDir, 'taskTools.ts'), wrapCode('executeTaskTool', taskCode));
fs.writeFileSync(path.join(toolsDir, 'hrTools.ts'), wrapCode('executeHrTool', hrCode));
fs.writeFileSync(path.join(toolsDir, 'attendanceTools.ts'), wrapCode('executeAttendanceTool', attendanceCode));

// Now replace the switch statement in index.ts
switchStatement.replaceWithText(`
  if (['${taskTools.join("', '")}'].includes(name)) {
    return (await import('./mcp/tools/taskTools')).executeTaskTool(name, args, user, isBoss, apiClient);
  }
  if (['${hrTools.join("', '")}'].includes(name)) {
    return (await import('./mcp/tools/hrTools')).executeHrTool(name, args, user, isBoss, apiClient);
  }
  if (['${attendanceTools.join("', '")}'].includes(name)) {
    return (await import('./mcp/tools/attendanceTools')).executeAttendanceTool(name, args, user, isBoss, apiClient);
  }
  throw new McpError(ErrorCode.MethodNotFound, \`Unknown tool: \${name}\`);
`);

sourceFile.saveSync();
console.log("Refactored index.ts successfully!");
