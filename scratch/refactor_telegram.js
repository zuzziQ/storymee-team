const { Project } = require("ts-morph");
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths("/Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/src/**/*.ts");

const sourceFile = project.getSourceFileOrThrow("telegram_agent.ts");

const handlersDir = '/Users/imam/storymee/2-MCP-Core/storymeeteam-mcp/src/telegram/handlers';
if (!fs.existsSync(handlersDir)) {
  fs.mkdirSync(handlersDir, { recursive: true });
}

const imports = `import { fetchAxios } from '../../fetchAxios';
import { CoreApiClient, API_ROUTES } from "@storymee/api-client";
import { 
  getCachedMembers, createCalendarKeyboard, sendMessage, 
  formatTelegramText, userFormSession, processingActions, 
  actionCache, chatHistories, KEYBOARD_MAIN, KEYBOARD_UNAUTHORIZED, 
  calculateWorkingHours, checkRealtimeOverdueDeadlines 
} from '../../telegram_agent';
import { executeMcpTool } from '../../index';
import * as dotenv from "dotenv";

dotenv.config();

const TELEGRAM_API = \`https://api.telegram.org/bot\${process.env.TELEGRAM_BOT_TOKEN}\`;
const CORE_API_URL = process.env.CORE_API_URL || "http://localhost:4500";
const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://api.storymee.com";
const OMNIROUTER_API_URL = process.env.OMNIROUTER_API_URL || "https://api.storymee.com/api/ai/chat";
const apiClient = new CoreApiClient({ baseURL: CORE_API_URL });
`;

// Extract handleCallbackQuery
const handleCallbackQueryFunc = sourceFile.getFunction("handleCallbackQuery");
if (handleCallbackQueryFunc) {
  const code = handleCallbackQueryFunc.getText();
  fs.writeFileSync(handlersDir + '/callbackQueryHandler.ts', imports + '\n' + code + '\nexport { handleCallbackQuery };\n');
  handleCallbackQueryFunc.replaceWithText(`
export async function handleCallbackQuery(callbackQuery: any) {
  return (await import('./telegram/handlers/callbackQueryHandler')).handleCallbackQuery(callbackQuery);
}
`);
}

// Extract handleTelegramMessage
const handleTelegramMessageFunc = sourceFile.getFunction("handleTelegramMessage");
if (handleTelegramMessageFunc) {
  const code = handleTelegramMessageFunc.getText();
  fs.writeFileSync(handlersDir + '/messageHandler.ts', imports + '\n' + code + '\nexport { handleTelegramMessage };\n');
  handleTelegramMessageFunc.replaceWithText(`
export async function handleTelegramMessage(message: any) {
  return (await import('./telegram/handlers/messageHandler')).handleTelegramMessage(message);
}
`);
}

sourceFile.saveSync();
console.log("Refactored telegram_agent.ts successfully!");
