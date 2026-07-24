/**
 * sessionStore.ts
 * Shared in-process state for output collection sessions.
 * Dùng Map thay vì Redis vì cùng process, không cần persistence.
 */

export interface OutputSession {
  issueId: string;        // UUID của issue trong DB
  issueShortId: string;   // VD: STO80-2
  issueTitle: string;
  memberId: string;
  texts: string[];
  urls: string[];         // Links được parse từ text hoặc telegram file URL
  startedAt: Date;
}

/**
 * Key: chatId (number) của nhân sự đang trong session nộp output
 */
export const outputSessions = new Map<number, OutputSession>();

/**
 * Pending requests từ planeTools → messageHandler biết cần mở session.
 * Key: username (lowercase, không @), Value: { issueId, issueShortId, issueTitle, memberId }
 */
export const pendingOutputByUsername = new Map<string, {
  issueId: string;
  issueShortId: string;
  issueTitle: string;
  memberId: string;
}>();
