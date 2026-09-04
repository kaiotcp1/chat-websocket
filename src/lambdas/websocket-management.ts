import { ApiGatewayManagementApiClient, GoneException } from "@aws-sdk/client-apigatewaymanagementapi";
import type { WebSocketEvent } from "./contracts";

export function createManagementClient(event: WebSocketEvent) {
  const { domainName, stage } = event.requestContext;
  return new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
}

export function isGoneConnectionError(error: unknown) {
  return error instanceof GoneException || (error as { name?: string }).name === "GoneException";
}
