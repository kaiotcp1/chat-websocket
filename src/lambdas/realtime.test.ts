import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dbSend: vi.fn(), managementSend: vi.fn() }));

vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: class {} }));
vi.mock("@aws-sdk/lib-dynamodb", () => {
  class Command { constructor(public input: unknown) {} }
  return {
    DynamoDBDocumentClient: { from: () => ({ send: mocks.dbSend }) },
    DeleteCommand: class DeleteCommand extends Command {},
    GetCommand: class GetCommand extends Command {},
    QueryCommand: class QueryCommand extends Command {},
    UpdateCommand: class UpdateCommand extends Command {}
  };
});
vi.mock("@aws-sdk/client-apigatewaymanagementapi", () => {
  class GoneException extends Error { override name = "GoneException"; }
  class PostToConnectionCommand { constructor(public input: unknown) {} }
  class ApiGatewayManagementApiClient { send = mocks.managementSend; }
  return { GoneException, PostToConnectionCommand, ApiGatewayManagementApiClient };
});

process.env.CONNECTIONS_TABLE = "connections";
const { handleMessage } = await import("./realtime");

const event = { body: null, requestContext: { connectionId: "sender", domainName: "example.execute-api.us-east-1.amazonaws.com", stage: "v1", routeKey: "sendMessage" } };

describe("realtime handler", () => {
  beforeEach(() => { mocks.dbSend.mockReset(); mocks.managementSend.mockReset(); });

  it("broadcasts a chat message to room members", async () => {
    mocks.dbSend
      .mockResolvedValueOnce({ Item: { connectionId: "sender", roomId: "aws-lab", nickname: "Kai" } })
      .mockResolvedValueOnce({ Items: [{ connectionId: "sender", roomId: "aws-lab", nickname: "Kai" }, { connectionId: "peer", roomId: "aws-lab", nickname: "Ada" }] });

    await handleMessage(event, { action: "sendMessage", content: "Olá", clientMessageId: "msg-1" });

    expect(mocks.managementSend).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mocks.managementSend.mock.calls[0][0].input.Data.toString())).toMatchObject({ type: "chatMessage", id: "msg-1", nickname: "Kai", content: "Olá" });
  });

  it("removes a stale connection after GoneException", async () => {
    const { GoneException } = await import("@aws-sdk/client-apigatewaymanagementapi");
    mocks.dbSend
      .mockResolvedValueOnce({ Item: { connectionId: "sender", roomId: "aws-lab", nickname: "Kai" } })
      .mockResolvedValueOnce({ Items: [{ connectionId: "stale", roomId: "aws-lab", nickname: "Ada" }] })
      .mockResolvedValueOnce({});
    mocks.managementSend.mockRejectedValueOnce(new GoneException());

    await handleMessage(event, { action: "typing", isTyping: true });

    expect(mocks.dbSend).toHaveBeenCalledTimes(3);
  });
});
