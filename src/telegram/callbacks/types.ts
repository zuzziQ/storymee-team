export interface TelegramCallbackContext {
  chatId: number;
  messageId: number;
  callbackQueryId: string;
  data: string;
  member: any;
  allMembers: any[];
  apiClient: any;
  callbackQuery: any;
}

export interface TelegramCallback {
  name: string;
  match(data: string): boolean;
  execute(ctx: TelegramCallbackContext): Promise<boolean>; // return true if handled
}
