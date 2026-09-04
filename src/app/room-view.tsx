"use client";

import type { FormEvent } from "react";
import type { ChatMessage, ServerEvent } from "./realtime-protocol";

type RoomViewProps = {
  roomId: string;
  status: string;
  messages: ChatMessage[];
  people: string[];
  typing: string[];
  events: ServerEvent[];
  message: string;
  onLeave: () => void;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function RoomView({ roomId, status, messages, people, typing, events, message, onLeave, onMessageChange, onSubmit }: RoomViewProps) {
  return <main><div className="topbar"><div><strong>#{roomId}</strong> <span className="online">● {status}</span></div><button onClick={onLeave}>Sair</button></div><div className="room"><section className="panel"><div className="messages">{messages.map((chat) => <article className="message" key={chat.id}><strong>{chat.nickname}</strong><small>{new Date(chat.sentAt).toLocaleTimeString()}</small><div>{chat.content}</div></article>)}{typing.map((name) => <div className="system" key={name}>{name} está digitando...</div>)}</div><form className="compose" onSubmit={onSubmit}><input value={message} maxLength={500} placeholder="Envie uma mensagem" onChange={(event) => onMessageChange(event.target.value)} /><button>Enviar</button></form></section><aside className="panel"><h2>Na sala ({people.length})</h2><ul className="people">{people.map((person) => <li key={person}>{person}</li>)}</ul><h3>Eventos</h3><div className="events">{events.map((event, index) => <div key={index}>{JSON.stringify(event)}</div>)}</div></aside></div></main>;
}
