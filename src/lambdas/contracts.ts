export type ClientAction = "joinRoom" | "leaveRoom" | "sendMessage" | "typing";
export type ClientMessage = { action: ClientAction; roomId?: string; nickname?: string; content?: string; clientMessageId?: string; isTyping?: boolean };
export type Connection = { connectionId: string; roomId?: string; nickname?: string; connectedAt: number; ttl: number };
export type WebSocketEvent = { body?: string | null; requestContext: { connectionId: string; domainName: string; stage: string; routeKey: string } };
export const ROOM_PATTERN = /^[a-z0-9-]{1,32}$/i;
export const MAX_BODY_BYTES = 2048;

export function parseMessage(body: string | null | undefined): ClientMessage {
  if (!body || Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new Error("Payload inválido ou maior que 2 KB.");
  let value: unknown;
  try { value = JSON.parse(body); } catch { throw new Error("O payload deve ser JSON válido."); }
  if (!value) throw new Error("Payload WebSocket ausente.");
  return value as ClientMessage;
}

export function validateJoin(message: ClientMessage): asserts message is ClientMessage & { roomId: string; nickname: string } {
  if (!message.roomId || !ROOM_PATTERN.test(message.roomId)) throw new Error("A sala deve ter 1–32 letras, números ou hífens.");
  if (!message.nickname || message.nickname.trim().length > 24) throw new Error("O nickname deve ter entre 1 e 24 caracteres.");
}

export function validateChat(message: ClientMessage): asserts message is ClientMessage & { content: string } {
  if (!message.content || message.content.trim().length > 500) throw new Error("A mensagem deve ter entre 1 e 500 caracteres.");
}
