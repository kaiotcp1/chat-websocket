import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  ClientAction,
  ClientMessage,
  Connection,
  WebSocketEvent,
  parseMessage,
  validateChat,
  validateJoin,
} from "./contracts";
import {
  createManagementClient,
  isGoneConnectionError,
} from "./websocket-management";

const tableName = process.env.CONNECTIONS_TABLE!;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ok = { statusCode: 200, body: "" };

type RoomActionHandler = (
  event: WebSocketEvent,
  message: ClientMessage,
) => Promise<void>;

async function sendToConnection(
  event: WebSocketEvent,
  connectionId: string,
  payload: object,
) {
  try {
    await createManagementClient(event).send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(payload)),
      }),
    );
  } catch (error) {
    if (isGoneConnectionError(error))
      await db.send(
        new DeleteCommand({ TableName: tableName, Key: { connectionId } }),
      );
    else throw error;
  }
}

async function findRoomConnections(roomId: string) {
  const result = await db.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "roomId-index",
      KeyConditionExpression: "roomId = :room",
      ExpressionAttributeValues: { ":room": roomId },
    }),
  );
  return (result.Items ?? []) as Connection[];
}

async function broadcastToRoom(
  event: WebSocketEvent,
  roomId: string,
  payload: object,
) {
  const connections = await findRoomConnections(roomId);
  await Promise.all(
    connections.map((connection) =>
      sendToConnection(event, connection.connectionId, payload),
    ),
  );
}

function getParticipantNames(connections: Connection[]) {
  return connections.flatMap((connection) =>
    connection.nickname ? [connection.nickname] : [],
  );
}

async function broadcastPresence(event: WebSocketEvent, roomId: string) {
  const connections = await findRoomConnections(roomId);
  await broadcastToRoom(event, roomId, {
    type: "presenceUpdated",
    participants: getParticipantNames(connections),
  });
}

async function findConnection(connectionId: string) {
  const result = await db.send(
    new GetCommand({ TableName: tableName, Key: { connectionId } }),
  );
  return result.Item as Connection | undefined;
}

async function getActiveRoomConnection(
  event: WebSocketEvent,
): Promise<Connection & { roomId: string; nickname: string }> {
  const connection = await findConnection(event.requestContext.connectionId);
  if (!connection || !connection.roomId || !connection.nickname)
    throw new Error("Entre em uma sala antes de enviar eventos.");
  return {
    ...connection,
    roomId: connection.roomId,
    nickname: connection.nickname,
  };
}

async function joinRoom(event: WebSocketEvent, message: ClientMessage) {
  const connectionId = event.requestContext.connectionId;
  validateJoin(message);
  const previousConnection = await findConnection(connectionId);
  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { connectionId },
      UpdateExpression: "SET roomId = :room, nickname = :nickname",
      ExpressionAttributeValues: {
        ":room": message.roomId,
        ":nickname": message.nickname.trim(),
      },
    }),
  );
  if (
    previousConnection?.roomId &&
    previousConnection.roomId !== message.roomId
  )
    await broadcastPresence(event, previousConnection.roomId);
  const participants = getParticipantNames(
    await findRoomConnections(message.roomId),
  );
  await sendToConnection(event, connectionId, {
    type: "roomJoined",
    roomId: message.roomId,
    participants,
  });
  await broadcastPresence(event, message.roomId);
}

async function leaveRoom(event: WebSocketEvent) {
  const connection = await getActiveRoomConnection(event);
  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { connectionId: connection.connectionId },
      UpdateExpression: "REMOVE roomId, nickname",
    }),
  );
  await broadcastPresence(event, connection.roomId);
}

async function sendChatMessage(event: WebSocketEvent, message: ClientMessage) {
  const connection = await getActiveRoomConnection(event);
  validateChat(message);
  await broadcastToRoom(event, connection.roomId, {
    type: "chatMessage",
    id: message.clientMessageId ?? crypto.randomUUID(),
    nickname: connection.nickname,
    content: message.content.trim(),
    sentAt: new Date().toISOString(),
  });
}

async function broadcastTyping(event: WebSocketEvent, message: ClientMessage) {
  const connection = await getActiveRoomConnection(event);
  await broadcastToRoom(event, connection.roomId, {
    type: "typing",
    nickname: connection.nickname,
    isTyping: Boolean(message.isTyping),
  });
}

const roomActionHandlers: Record<ClientAction, RoomActionHandler> = {
  joinRoom,
  leaveRoom,
  sendMessage: sendChatMessage,
  typing: broadcastTyping,
};

export async function handleMessage(
  event: WebSocketEvent,
  message: ClientMessage,
) {
  const actionHandler = roomActionHandlers[message.action];
  if (actionHandler) return actionHandler(event, message);
  throw new Error("Ação WebSocket desconhecida.");
}

export async function handler(event: WebSocketEvent) {
  try {
    await handleMessage(event, parseMessage(event.body));
  } catch (error) {
    await sendToConnection(event, event.requestContext.connectionId, {
      type: "error",
      message: error instanceof Error ? error.message : "Erro inesperado.",
    });
  }
  return ok;
}
