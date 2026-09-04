import { PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { WebSocketEvent } from "./contracts";
import { createManagementClient, isGoneConnectionError } from "./websocket-management";

const tableName = process.env.CONNECTIONS_TABLE!;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const response = { statusCode: 200, body: "" };

export async function handler(event: WebSocketEvent) {
  const { connectionId, routeKey } = event.requestContext;
  if (routeKey === "$connect") {
    const now = Math.floor(Date.now() / 1000);
    await db.send(new PutCommand({ TableName: tableName, Item: { connectionId, connectedAt: now, ttl: now + 7800 } }));
    try {
      await createManagementClient(event).send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: Buffer.from(JSON.stringify({ type: "connected" })) }));
    } catch (error) {
      // The handshake may finish before a callback can be delivered. The client
      // still receives roomJoined after its first action, so do not reject $connect.
      if (!isGoneConnectionError(error)) throw error;
    }
  }
  if (routeKey === "$disconnect") await db.send(new DeleteCommand({ TableName: tableName, Key: { connectionId } }));
  return response;
}
