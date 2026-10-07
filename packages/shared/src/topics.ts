/** The five Kafka topics (Aiven free tier allows exactly five). */
export const TOPICS = {
  messagesSent: 'messages.sent',
  messagesReceipts: 'messages.receipts',
  presenceEvents: 'presence.events',
  aiJobs: 'ai.jobs',
  analyticsEvents: 'analytics.events',
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];
export const ALL_TOPICS = Object.values(TOPICS) as Topic[];
