import WebSocket from "ws";

const endpoint = process.argv[2];
if (!endpoint) throw new Error("Usage: npm run smoke:websocket -- <wss-url>");

const roomId = `smoke-${Date.now()}`;
const timeout = (ms, message) => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
const open = (name) => new Promise((resolve, reject) => {
  const client = new WebSocket(endpoint);
  client.once("open", () => resolve(client));
  client.once("error", reject);
  setTimeout(() => reject(new Error(`Timed out opening ${name}`)), 15000);
});
const event = (client, predicate) => new Promise((resolve) => {
  const listener = (data) => {
    const parsed = JSON.parse(data.toString());
    if (predicate(parsed)) { client.off("message", listener); resolve(parsed); }
  };
  client.on("message", listener);
});

const first = await open("first client");
const second = await open("second client");
try {
  first.send(JSON.stringify({ action: "joinRoom", roomId, nickname: "smoke-one" }));
  await Promise.race([event(first, (message) => message.type === "roomJoined"), timeout(15000, "First client did not join")]);
  second.send(JSON.stringify({ action: "joinRoom", roomId, nickname: "smoke-two" }));
  await Promise.race([event(second, (message) => message.type === "roomJoined"), timeout(15000, "Second client did not join")]);
  const received = event(second, (message) => message.type === "chatMessage" && message.id === "smoke-message");
  first.send(JSON.stringify({ action: "sendMessage", content: "smoke test", clientMessageId: "smoke-message" }));
  await Promise.race([received, timeout(15000, "Second client did not receive chat message")]);
  console.log("WebSocket smoke test passed.");
} finally {
  first.close();
  second.close();
}
