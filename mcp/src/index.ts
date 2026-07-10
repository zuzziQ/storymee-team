import { fetchAxios } from './fetchAxios';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { connect } from "nats";

import { PLANE_TOOLS_SCHEMA, executePlaneTool } from './mcp/tools/planeTools';
import { HR_TOOLS_SCHEMA, executeHrTool } from './mcp/tools/hrTools';
import { ATTENDANCE_TOOLS_SCHEMA, executeAttendanceTool } from './mcp/tools/attendanceTools';

dotenv.config();


import { startTelegramPolling } from './telegram_agent';

const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:5100";
let apiClient = new CoreApiClient({ 
    baseURL: CORE_API_URL + '/internal/v1/team', 
    enforceApiPrefix: false
});

let cachedMembers: any[] | null = null;
let lastCacheTime = 0;

export async function getTeamMembersCache(): Promise<any[]> {
  if (cachedMembers && Date.now() - lastCacheTime < 60000) {
    return cachedMembers;
  }
  try {
    const data = (await apiClient.get(API_ROUTES.HR.TEAM_MEMBERS)) as any;
    cachedMembers = data.data || [];
    lastCacheTime = Date.now();
    return cachedMembers as any[];
  } catch (err: any) {
    console.error("[MCP Error] 32603 - Core API connect failed:", err.message);
    throw new McpError(ErrorCode.InternalError, `Không thể kết nối đến Core API Service (32603): ${err.message}`);
  }
}

// Trợ giúp phân quyền & xác thực
async function authorizeClient() {
  const email = process.env.STORYMEE_USER_EMAIL;
  if (!email) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "LỖI BẢO MẬT: Chưa cấu hình biến môi trường STORYMEE_USER_EMAIL trong file settings MCP."
    );
  }

  const members = await getTeamMembersCache();
  
  const user = members.find((m: any) => m.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `LỖI BẢO MẬT: Không tìm thấy nhân sự có email ${email} trong hệ thống.`
    );
  }

  const isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(email.toLowerCase());
  return { user, isBoss, members };
}

// Khởi tạo MCP Server
const server = new Server(
  {
    name: "storymeeteam-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Định nghĩa danh sách các công cụ bằng Dynamic AST Loading
const allTools = [
  ...PLANE_TOOLS_SCHEMA,
  ...HR_TOOLS_SCHEMA,
  ...ATTENDANCE_TOOLS_SCHEMA
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools as any
  };
});

// Xử lý thực thi công cụ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { user } = await authorizeClient();
  return executeMcpTool(name, args, user);
});

export async function executeMcpTool(
  name: string,
  args: any,
  user: any
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const isBoss = ["kimngan151091@gmail.com", "lehuyducanh.vn@gmail.com", "zuzzivn@gmail.com"].includes(user.email.toLowerCase());
  const members = await getTeamMembersCache();

  // ALIAS mapping for LLM compatibility
  let toolName = name;
  if (toolName === 'create_task') toolName = 'create_issue';
  if (toolName === 'update_task') toolName = 'update_issue';
  if (toolName === 'breakdown_task') toolName = 'breakdown_issue';
  if (toolName === 'update_subtasks') toolName = 'update_sub_issues';
  if (toolName === 'request_task_approval') toolName = 'request_issue_approval';
  if (toolName === 'approve_task_request') toolName = 'approve_issue_request';
  if (toolName === 'get_task_details') toolName = 'get_issue_details';

      const planeNames = PLANE_TOOLS_SCHEMA.map(t => t.name);
      const hrNames = HR_TOOLS_SCHEMA.map(t => t.name);
      const attendanceNames = ATTENDANCE_TOOLS_SCHEMA.map(t => t.name);

      if (planeNames.includes(toolName)) {
        return executePlaneTool(toolName, args, user, isBoss, apiClient, members);
      }
      if (hrNames.includes(toolName)) {
        return executeHrTool(toolName, args, user, isBoss, apiClient, members);
      }
      if (attendanceNames.includes(toolName)) {
        return executeAttendanceTool(toolName, args, user, isBoss, apiClient, members);
      }
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName} (original: ${name})`);

}

// Chạy server StdIO
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("StorymeeTeam MCP Server đã khởi chạy và kết nối qua StdIO!");

  // 💓 NATS JetStream Heartbeat
  try {
    const natsUrl = process.env.NATS_URL || "nats://localhost:4222";
    const nc = await connect({ servers: natsUrl, maxReconnectAttempts: -1 });
    const js = nc.jetstream();
    const kv = await js.views.kv("system_radar", { history: 1 });
    
    const sendHeartbeat = async () => {
      try {
        const payload = JSON.stringify({
          status: "online",
          lastSeen: Date.now(),
          type: "mcp",
          name: "storymeeteam-mcp"
        });
        await kv.put("storymeeteam-mcp", new TextEncoder().encode(payload));

        const botPayload = JSON.stringify({
          status: "online",
          lastSeen: Date.now(),
          type: "bot",
          name: "StorymeeTeam Bot"
        });
        await kv.put("storymeeteam-bot-agent", new TextEncoder().encode(botPayload));
      } catch (err: any) {
        console.error("[NATS] Heartbeat error:", err.message);
      }
    };

    await sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
    console.error("[NATS] Heartbeat initialized for storymeeteam-mcp");
  } catch (err: any) {
    console.error("[NATS] Failed to initialize NATS heartbeat:", err.message);
  }

  // Khởi chạy Telegram Bot Webhook
  try {
    await startTelegramPolling();
    console.error("Telegram Webhook/Polling started successfully.");
  } catch (err: any) {
    console.error("Failed to start Telegram Bot:", err.message);
  }
}

main().catch((error) => {
  console.error("Lỗi khởi chạy server:", error);
  process.exit(1);
});
