export type ServerEvent = {
  type: string;
  [key: string]: unknown;
};

export type ChatMessage = {
  id: string;
  nickname: string;
  content: string;
  sentAt: string;
};

export const websocketEndpoint = process.env.NEXT_PUBLIC_WS_URL;
