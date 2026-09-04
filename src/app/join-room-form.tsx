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
  const hasError = status.startsWith("Erro") || status.startsWith("Defina") || status.startsWith("Falha");

  return (
    <main className="min-h-screen bg-[#090f18] px-4 py-5 font-[Arial,Helvetica,sans-serif] text-slate-100 sm:px-8 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden border border-[#2a4159] bg-[#101a27] shadow-[0_30px_80px_rgba(0,0,0,0.42)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative overflow-hidden border-b border-[#2a4159] bg-[#0c1622] px-7 py-10 sm:px-12 lg:border-r lg:border-b-0 lg:py-16">
          <div className="absolute -right-16 top-10 h-64 w-64 rounded-full border border-[#1f4967] opacity-50" />
          <div className="absolute -right-4 top-20 h-44 w-44 rounded-full border border-[#306b91] opacity-40" />
          <div className="relative flex h-full flex-col justify-between gap-16">
            <div>
              <div className="flex items-center gap-3 text-[#66c0f4]">
                <span className="grid h-10 w-10 place-items-center border border-[#66c0f4]/70 bg-[#102a3d] text-lg font-bold">R</span>
                <span className="text-sm font-semibold tracking-[0.16em]">REALTIME ROOMS</span>
              </div>
              <div className="mt-16 max-w-sm">
                <p className="text-sm leading-6 text-[#8ea8bd]">Laboratório AWS para observar cada evento WebSocket enquanto ele acontece.</p>
                <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#e7f3ff] sm:text-5xl">Entre e veja uma sala ganhar vida.</h1>
              </div>
            </div>

            <div className="grid max-w-sm gap-px border border-[#25435a] bg-[#25435a] text-sm text-[#9fb5c7] sm:grid-cols-3">
              <div className="bg-[#101d2b] p-4"><span className="block text-xl font-semibold text-[#d7ebfa]">01</span> conexão</div>
              <div className="bg-[#101d2b] p-4"><span className="block text-xl font-semibold text-[#d7ebfa]">02</span> presença</div>
              <div className="bg-[#101d2b] p-4"><span className="block text-xl font-semibold text-[#d7ebfa]">03</span> mensagens</div>
            </div>
          </div>
        </section>

        <section className="flex items-center px-7 py-10 sm:px-12 lg:px-16">
          <div className="w-full max-w-md">
            <p className="text-sm font-medium text-[#66c0f4]">Conectar à sala</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">Pronto para participar?</h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[#8ea8bd]">Use um nome curto e escolha a sala. Você pode abrir outra aba para testar o broadcast.</p>

            <form className="mt-9 grid gap-5" onSubmit={onSubmit}>
              <label className="grid gap-2 text-sm font-medium text-[#b9cde0]">
                Seu nome
                <input aria-label="Seu nome" maxLength={24} placeholder="Ex.: Kaio" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} className="h-12 border border-[#385771] bg-[#0a131e] px-3 text-white outline-none placeholder:text-[#60758a] focus:border-[#66c0f4] focus:ring-2 focus:ring-[#66c0f4]/20" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#b9cde0]">
                Sala
                <input aria-label="Sala" maxLength={32} placeholder="Ex.: aws-lab" value={roomId} onChange={(event) => onRoomIdChange(event.target.value)} className="h-12 border border-[#385771] bg-[#0a131e] px-3 text-white outline-none placeholder:text-[#60758a] focus:border-[#66c0f4] focus:ring-2 focus:ring-[#66c0f4]/20" />
              </label>
              <button type="submit" className="mt-2 h-12 bg-[#1a9fff] px-5 text-sm font-bold text-[#06111b] transition-colors hover:bg-[#66c0f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#66c0f4] disabled:cursor-not-allowed disabled:opacity-50">Entrar na sala</button>
            </form>

            <p role={hasError ? "alert" : "status"} className={`mt-5 text-sm ${hasError ? "text-[#f29494]" : "text-[#89a3b8]"}`}>{status}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
