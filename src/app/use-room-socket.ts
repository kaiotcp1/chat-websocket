"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ChatMessage,
  type ServerEvent,
  websocketEndpoint,
} from "./realtime-protocol";

type RoomConnection = {
  nickname: string;
  roomId: string;
};

const typingPauseMs = 1200;
const remoteTypingExpiryMs = 2500;

function createClientMessageId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `message-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

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
  const typingActive = useRef(false);
  const typingStopTimer = useRef<number | null>(null);
  const remoteTypingTimers = useRef(new Map<string, number>());

  const send = useCallback((payload: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(payload));
    }
  }, []);

  const handleServerEvent = useCallback(
    (event: ServerEvent) => {
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
        const typingNickname = String(event.nickname);
        if (typingNickname === nickname) return;

        const previousTimer = remoteTypingTimers.current.get(typingNickname);
        if (previousTimer) window.clearTimeout(previousTimer);

        if (!event.isTyping) {
          remoteTypingTimers.current.delete(typingNickname);
          setTyping((current) =>
            current.filter((name) => name !== typingNickname),
          );
          return;
        }

        setTyping((current) =>
          current.includes(typingNickname)
            ? current
            : [...current, typingNickname],
        );
        remoteTypingTimers.current.set(
          typingNickname,
          window.setTimeout(() => {
            remoteTypingTimers.current.delete(typingNickname);
            setTyping((current) =>
              current.filter((name) => name !== typingNickname),
            );
          }, remoteTypingExpiryMs),
        );
      }
      if (event.type === "error") {
        setStatus(`Erro: ${String(event.message)}`);
      }
    },
    [nickname],
  );

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
    if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
    if (typingActive.current) send({ action: "typing", isTyping: false });
    typingActive.current = false;
    send({ action: "leaveRoom" });
    socket.current?.close();
  }, [send]);

  const sendMessage = useCallback(
    (content: string) => {
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (typingActive.current) send({ action: "typing", isTyping: false });
      typingActive.current = false;
      send({
        action: "sendMessage",
        content,
        clientMessageId: createClientMessageId(),
      });
    },
    [send],
  );

  const updateTyping = useCallback(
    (isTyping: boolean) => {
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      if (!isTyping) {
        if (typingActive.current) send({ action: "typing", isTyping: false });
        typingActive.current = false;
        return;
      }

      if (!typingActive.current) send({ action: "typing", isTyping: true });
      typingActive.current = true;
      typingStopTimer.current = window.setTimeout(() => {
        if (typingActive.current) send({ action: "typing", isTyping: false });
        typingActive.current = false;
      }, typingPauseMs);
    },
    [send],
  );

  useEffect(
    () => () => {
      intentionalClose.current = true;
      if (typingStopTimer.current) window.clearTimeout(typingStopTimer.current);
      remoteTypingTimers.current.forEach((timer) => window.clearTimeout(timer));
      if (typingActive.current) send({ action: "typing", isTyping: false });
      socket.current?.close();
    },
    [send],
  );

  return {
    joined,
    status,
    messages,
    people,
    typing,
    events,
    connect,
    leaveRoom,
    sendMessage,
    updateTyping,
  };
}
