"use client";

import type { FormEvent } from "react";

type JoinRoomFormProps = {
  nickname: string;
  roomId: string;
  status: string;
  onNicknameChange: (nickname: string) => void;
  onRoomIdChange: (roomId: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function JoinRoomForm({ nickname, roomId, status, onNicknameChange, onRoomIdChange, onSubmit }: JoinRoomFormProps) {
  const statusClassName = status.startsWith("Erro") ? "error status" : "status";

  return <main><section className="intro"><h1>Realtime Rooms</h1><p>Uma sala de chat pública para explorar API Gateway WebSocket, Lambda e DynamoDB.</p><form className="form" onSubmit={onSubmit}><input aria-label="Seu nome" maxLength={24} placeholder="Seu nickname" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} /><input aria-label="Sala" maxLength={32} placeholder="Nome da sala" value={roomId} onChange={(event) => onRoomIdChange(event.target.value)} /><button type="submit">Entrar na sala</button></form><p className={statusClassName}>{status}</p></section></main>;
}
