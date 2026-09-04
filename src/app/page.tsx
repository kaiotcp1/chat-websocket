"use client";

import { FormEvent, useState } from "react";
import { JoinRoomForm } from "./join-room-form";
import { RoomView } from "./room-view";
import { useRoomSocket } from "./use-room-socket";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("aws-lab");
  const [text, setText] = useState("");
  const { joined, status, messages, people, typing, events, connect, leaveRoom, sendMessage, updateTyping } = useRoomSocket({ nickname, roomId });

  function enter(event: FormEvent) { event.preventDefault(); if (nickname.trim() && roomId.trim()) connect(); }
  function submit(event: FormEvent) { event.preventDefault(); if (!text.trim()) return; sendMessage(text.trim()); setText(""); }
  function changeMessage(message: string) { setText(message); updateTyping(Boolean(message)); }

  if (!joined) return <JoinRoomForm nickname={nickname} roomId={roomId} status={status} onNicknameChange={setNickname} onRoomIdChange={setRoomId} onSubmit={enter} />;

  return <RoomView roomId={roomId} status={status} messages={messages} people={people} typing={typing} events={events} message={text} onLeave={leaveRoom} onMessageChange={changeMessage} onSubmit={submit} />;
}
