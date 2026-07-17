export interface TelegramMessageContext {
  chatId: number;
  username?: string;
  text: string;
  lowerText: string;
  isGroup: boolean;
  member: any;
  allMembers: any[];
  apiClient: any;
  message: any;
}

export interface TelegramCommand {
  name: string;
  description: string;
  match(text: string, lowerText: string): boolean;
  execute(ctx: TelegramMessageContext): Promise<boolean>; // return true if handled
}
