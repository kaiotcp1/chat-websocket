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

const jsonToken = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

function JsonEvent({ event }: { event: ServerEvent }) {
  const json = JSON.stringify(event, null, 2) ?? "{}";
  const tokens = [];
  let cursor = 0;

  for (const match of json.matchAll(jsonToken)) {
    const start = match.index!;
    tokens.push(<span key={`plain-${start}`}>{json.slice(cursor, start)}</span>);

    const color = match[1] ? "text-[#72c7ff]" : match[2] ? "text-[#d9b46d]" : match[3] ? "text-[#c6a5ff]" : "text-[#e58bb8]";
    tokens.push(<span className={color} key={`token-${start}`}>{match[0]}</span>);
    cursor = start + match[0].length;
  }

  tokens.push(<span key="plain-end">{json.slice(cursor)}</span>);
  return <code className="block whitespace-pre-wrap break-words">{tokens}</code>;
}

function EventStream({ events }: Pick<RoomViewProps, "events">) {
  return (
    <details className="group mt-7 border-t border-[#284055] pt-4" open>
      <summary className="cursor-pointer list-none text-sm font-semibold text-[#b7cbdc] marker:hidden">
        <span className="flex items-center justify-between"><span>Eventos recebidos</span><span className="flex items-center gap-2"><span className="border border-[#35546b] bg-[#122333] px-1.5 py-0.5 text-[11px] font-normal text-[#a4c3d7]">{events.length}</span><span className="text-[#658097] group-open:rotate-45">+</span></span></span>
      </summary>
      <div className="mt-3 min-h-64 max-h-[34rem] overflow-auto border border-[#263e53] bg-[#09121c] p-3 font-mono text-xs leading-5 text-[#8fa8ba] shadow-inner shadow-black/30">
        {events.length ? events.map((event, index) => <pre className="border-b border-[#1b2c3c] py-3 last:border-0" key={`${event.type}-${index}`}><JsonEvent event={event} /></pre>) : <p>Nenhum evento recebido ainda.</p>}
      </div>
    </details>
  );
}

export function RoomView({ roomId, status, messages, people, typing, events, message, onLeave, onMessageChange, onSubmit }: RoomViewProps) {
  const connected = status === "Conectado";

  return (
    <main className="min-h-screen bg-[#090f18] font-[Arial,Helvetica,sans-serif] text-[#dbeaf6]">
      <header className="flex min-h-16 items-center justify-between border-b border-[#2a4159] bg-[#101a27] px-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center border border-[#66c0f4]/70 bg-[#102a3d] text-sm font-bold text-[#66c0f4]">R</span>
          <span className="text-sm font-semibold tracking-[0.12em] text-[#e5f3ff]">REALTIME ROOMS</span>
        </div>
        <button onClick={onLeave} className="border border-[#466177] px-3 py-2 text-xs font-semibold text-[#b6cbda] transition-colors hover:border-[#7d9bb0] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#66c0f4]">Sair da sala</button>
      </header>

      <div className="mx-auto grid max-w-[1600px] lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="border-b border-[#2a4159] bg-[#0c1622] p-5 lg:border-r lg:border-b-0">
          <p className="text-xs font-medium text-[#7190a8]">Sala ativa</p>
          <div className="mt-3 border-l-2 border-[#66c0f4] bg-[#112536] px-3 py-3">
            <p className="truncate font-semibold text-[#e8f4fd]">#{roomId}</p>
            <p className="mt-1 text-xs text-[#7f9db2]">API Gateway WebSocket</p>
          </div>
          <div className="mt-8 border-t border-[#284055] pt-5 text-sm leading-6 text-[#89a3b8]">
            <p className="font-medium text-[#bfd4e4]">O que observar</p>
            <p className="mt-2">Abra esta mesma sala em outra aba. Presença, digitação e mensagens chegam sem atualizar a página.</p>
          </div>
        </aside>

        <section className="flex min-h-[540px] min-w-0 flex-col border-b border-[#2a4159] bg-[#101a27] lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between border-b border-[#2a4159] px-5 py-4 sm:px-7">
            <div>
              <h1 className="text-lg font-semibold text-white">#{roomId}</h1>
              <p className="mt-1 text-xs text-[#829fb4]">Conversa ao vivo</p>
            </div>
            <div className={`flex items-center gap-2 text-xs font-medium ${connected ? "text-[#9be5c2]" : "text-[#f3c778]"}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-[#55d995] shadow-[0_0_10px_#55d995]" : "bg-[#e7ad56]"}`} />
              {status}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-auto px-5 py-6 sm:px-7">
            {messages.length ? messages.map((chat) => (
              <article className="max-w-2xl border-l-2 border-[#2b526d] bg-[#132333] px-4 py-3" key={chat.id}>
                <div className="flex items-baseline gap-3"><strong className="text-sm text-[#dceefd]">{chat.nickname}</strong><time className="text-xs text-[#718da2]">{new Date(chat.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>
                <p className="mt-2 break-words text-sm leading-6 text-[#b9cddd]">{chat.content}</p>
              </article>
            )) : <div className="grid min-h-56 place-items-center border border-dashed border-[#2d4b63] px-6 text-center"><p className="max-w-xs text-sm leading-6 text-[#7f9bad]">A sala está pronta. Envie a primeira mensagem ou conecte outra aba para observar os eventos.</p></div>}
            {typing.map((name) => <p className="text-xs italic text-[#7fa9c8]" key={name}>{name} está digitando…</p>)}
          </div>

          <form className="border-t border-[#2a4159] bg-[#0d1722] p-4 sm:p-5" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="chat-message">Mensagem</label>
            <div className="flex gap-3">
              <input id="chat-message" value={message} maxLength={500} placeholder="Escreva uma mensagem para a sala" onChange={(event) => onMessageChange(event.target.value)} className="h-11 min-w-0 flex-1 border border-[#385771] bg-[#08111a] px-3 text-sm text-white outline-none placeholder:text-[#617a8d] focus:border-[#66c0f4] focus:ring-2 focus:ring-[#66c0f4]/20" />
              <button className="bg-[#1a9fff] px-4 text-sm font-bold text-[#06111b] transition-colors hover:bg-[#66c0f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#66c0f4] disabled:cursor-not-allowed disabled:opacity-50">Enviar</button>
            </div>
            <p className="mt-2 text-xs text-[#607b90]">Enter envia · até 500 caracteres</p>
          </form>
        </section>

        <aside className="bg-[#0c1622] p-5 sm:p-7 lg:p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-[#e6f3fd]">Na sala</h2><span className="border border-[#35546b] bg-[#122333] px-2 py-0.5 text-xs text-[#a4c3d7]">{people.length}</span></div>
          <ul className="mt-4 grid gap-2">
            {people.length ? people.map((person) => <li className="flex items-center gap-2 text-sm text-[#b9ccda]" key={person}><span className="h-1.5 w-1.5 rounded-full bg-[#61d39a]" />{person}</li>) : <li className="text-sm text-[#708da3]">Aguardando presença…</li>}
          </ul>
          <EventStream events={events} />
        </aside>
      </div>
    </main>
  );
}
