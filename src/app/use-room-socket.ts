"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatMessage, type ServerEvent, websocketEndpoint } from "./realtime-protocol";

type RoomConnection = {
  nickname: string;
  roomId: string;
};

export function useRoomSocket({ nickname, roomId }: RoomConnection) {
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("Desconectado");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [events, setEvents] = useState<ServerEvent[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const intentionalClose = useRef(false);

  const send = useCallback((payload: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(payload));
    }
  }, []);

  const handleServerEvent = useCallback((event: ServerEvent) => {
    setEvents((current) => [event, ...current].slice(0, 30));

    if (event.type === "roomJoined") {
      setJoined(true);
      setPeople((event.participants as string[]) ?? []);
    }
    if (event.type === "presenceUpdated") {
      setPeople((event.participants as string[]) ?? []);
    }
    if (event.type === "chatMessage") {
      setMessages((current) => [...current, event as unknown as ChatMessage]);
    }
    if (event.type === "typing") {
      setTyping(event.isTyping ? [String(event.nickname)] : []);
    }
    if (event.type === "error") {
      setStatus(`Erro: ${String(event.message)}`);
    }
  }, []);

  const connect = useCallback(() => {
    if (!websocketEndpoint) {
      setStatus("Defina NEXT_PUBLIC_WS_URL em .env.local");
      return;
    }

    intentionalClose.current = false;
    setStatus("Conectando...");
    const websocket = new WebSocket(websocketEndpoint);
    socket.current = websocket;

    websocket.onopen = () => {
      reconnectAttempt.current = 0;
      setStatus("Conectado");
      send({ action: "joinRoom", roomId, nickname });
    };
    websocket.onmessage = (message) => {
      try {
        handleServerEvent(JSON.parse(message.data) as ServerEvent);
      } catch {
        setStatus("Evento inválido recebido do servidor");
      }
    };
    websocket.onclose = () => {
      setJoined(false);
      if (intentionalClose.current) {
        setStatus("Desconectado");
        return;
      }
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current++, 10000);
      setStatus(`Reconectando em ${Math.round(delay / 1000)}s...`);
      window.setTimeout(connect, delay);
    };
    websocket.onerror = () => setStatus("Falha na conexão WebSocket");
  }, [handleServerEvent, nickname, roomId, send]);

  const leaveRoom = useCallback(() => {
    intentionalClose.current = true;
    send({ action: "leaveRoom" });
    socket.current?.close();
  }, [send]);

  const sendMessage = useCallback((content: string) => {
    send({ action: "sendMessage", content, clientMessageId: crypto.randomUUID() });
  }, [send]);

  const updateTyping = useCallback((isTyping: boolean) => {
    send({ action: "typing", isTyping });
  }, [send]);

  useEffect(() => () => {
    intentionalClose.current = true;
    socket.current?.close();
  }, []);

  return { joined, status, messages, people, typing, events, connect, leaveRoom, sendMessage, updateTyping };
}
