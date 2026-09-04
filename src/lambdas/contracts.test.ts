import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, parseMessage, validateChat, validateJoin } from "./contracts";

describe("WebSocket contract validation", () => {
  it("accepts a valid join action", () => {
    const message = parseMessage('{"action":"joinRoom","roomId":"aws-lab","nickname":"Kai"}');
    expect(() => validateJoin(message)).not.toThrow();
  });
  it("rejects invalid JSON and oversized payloads", () => {
    expect(() => parseMessage("not-json")).toThrow("JSON válido");
    expect(() => parseMessage("x".repeat(MAX_BODY_BYTES + 1))).toThrow("2 KB");
  });
  it("only requires a parsed payload value; action dispatch stays in the handler", () => {
    expect(parseMessage("[]")).toEqual([]);
    expect(() => parseMessage("null")).toThrow("ausente");
  });
  it("rejects invalid room, nickname and chat content", () => {
    expect(() => validateJoin({ action: "joinRoom", roomId: "two words", nickname: "Kai" })).toThrow();
    expect(() => validateJoin({ action: "joinRoom", roomId: "ok", nickname: "x".repeat(25) })).toThrow();
    expect(() => validateChat({ action: "sendMessage", content: "x".repeat(501) })).toThrow();
  });
});
