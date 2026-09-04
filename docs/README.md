# Como o chat WebSocket funciona

Este guia explica o que acontece entre o navegador e a AWS quando você usa uma sala do Realtime Rooms. Não é preciso conhecer WebSocket antes de começar.

## A ideia central

Em uma aplicação HTTP tradicional, o navegador faz uma requisição e espera uma resposta. Para receber outra atualização, ele precisa fazer outra requisição.

No chat, isso seria pouco prático: uma mensagem enviada por outra pessoa só apareceria se o navegador perguntasse repetidamente ao servidor se há novidades.

WebSocket cria uma conexão que permanece aberta. Depois de conectados, navegador e servidor podem enviar eventos um ao outro a qualquer momento.

No projeto, o ponto de entrada do navegador é o hook [`useRoomSocket`](../src/app/use-room-socket.ts#L18). Ele mantém o objeto `WebSocket`, recebe eventos e atualiza a tela.

```text
HTTP tradicional
navegador ── pedido ──> servidor
navegador <─ resposta ─ servidor

WebSocket
navegador <════════ conexão aberta ════════> servidor
           mensagens nos dois sentidos
```

## O que significa `wss://`

`wss://` é WebSocket protegido por TLS, a mesma camada de segurança usada por `https://`.

- `ws://`: WebSocket sem criptografia.
- `wss://`: WebSocket com criptografia em trânsito. É o endereço usado por este projeto.

O Terraform cria uma URL semelhante a esta:

```text
wss://iymb492cug.execute-api.us-east-1.amazonaws.com/v1
```

O frontend lê essa URL em `.env.local`:

```env
NEXT_PUBLIC_WS_URL=wss://<api-id>.execute-api.us-east-1.amazonaws.com/v1
```

A URL é montada pelo output Terraform [`websocket_url`](../infra/outputs.tf#L1-L4), a partir da API e do stage `v1` definidos em [`infra/main.tf`](../infra/main.tf#L157-L162) e [`infra/main.tf`](../infra/main.tf#L237-L250).

## Como a conexão é aberta

Quando você clica em **Entrar na sala**, o navegador cria um `WebSocket` com a URL acima. O navegador começa com uma requisição HTTPS especial, chamada _handshake_, e pede para transformar aquela comunicação em WebSocket. Se o API Gateway aceitar, responde com o status `101 Switching Protocols`; a conexão fica aberta.

> **Implementação desta etapa**
>
> - [Frontend — a função `connect` cria `new WebSocket(websocketEndpoint)`](../src/app/use-room-socket.ts#L75-L84).
> - [Infraestrutura — a API é declarada como `protocol_type = "WEBSOCKET"`](../infra/main.tf#L157-L162).
> - [Infraestrutura — a rota `$connect` aponta para a integração da Lambda](../infra/main.tf#L178-L183).
> - [Backend — a Lambda trata `$connect` e registra o `connectionId`](../src/lambdas/connection.ts#L11-L25).

```text
Navegador                 API Gateway                  Lambda connection
    │                           │                               │
    │──── abre wss://... ──────>│                               │
    │                           │──── rota $connect ───────────>│
    │                           │                               │── grava connectionId no DynamoDB
    │<════ conexão aberta ══════│<──────────────────────────────│
```

A rota especial `$connect` registra o `connectionId` no DynamoDB. Esse ID identifica uma aba/conexão, não uma pessoa. Se uma pessoa abrir duas abas, haverá dois `connectionId`s.

O registro também contém um TTL, portanto conexões abandonadas não ficam guardadas para sempre.

> **Implementação desta etapa:** [frontend — callbacks de abertura, mensagem, erro e reconexão](../src/app/use-room-socket.ts#L86-L109); [backend — gravação e remoção da conexão](../src/lambdas/connection.ts#L11-L25); [infraestrutura — tabela, índice e TTL](../infra/main.tf#L10-L35).

## Como o API Gateway escolhe a ação

Depois da conexão aberta, o frontend envia JSON. A API foi configurada com esta regra:

```text
$request.body.action
```

Isso significa que o API Gateway lê a propriedade `action` e a encaminha à rota correspondente.

```json
{ "action": "joinRoom", "roomId": "aws-lab", "nickname": "Kaio" }
```

| `action` enviada pelo cliente | Rota do API Gateway | O que acontece |
| --- | --- | --- |
| `joinRoom` | `joinRoom` | Associa a conexão a uma sala e envia a presença atual. |
| `leaveRoom` | `leaveRoom` | Remove sala e nickname da conexão. |
| `sendMessage` | `sendMessage` | Valida e distribui uma mensagem para a sala. |
| `typing` | `typing` | Avisa que uma pessoa começou ou parou de digitar. |
| ação desconhecida | `$default` | A Lambda responde com um evento `error`. |

As rotas de sala são atendidas pela Lambda `realtime-handler`. As rotas `$connect` e `$disconnect` usam a Lambda `connection-handler`.

> **Implementação desta etapa:** [infraestrutura — expressão que seleciona `action`](../infra/main.tf#L157-L162); [infraestrutura — rotas `joinRoom`, `leaveRoom`, `sendMessage` e `typing`](../infra/main.tf#L190-L218); [backend — mapa de ações para handlers](../src/lambdas/realtime.ts#L76-L86).

## Entrar em uma sala e presença

Quando recebe `joinRoom`, a Lambda atualiza o registro daquela conexão no DynamoDB com `roomId` e `nickname`.

Ela consulta o índice `roomId-index`, que encontra rapidamente todas as conexões da sala, e envia dois tipos de evento:

```text
1. roomJoined       → somente para quem acabou de entrar
2. presenceUpdated  → para todas as conexões da sala
```

Exemplo de presença recebida pelo navegador:

```json
{
  "type": "presenceUpdated",
  "participants": ["Kaio", "Ada"]
}
```

No primeiro corte, o DynamoDB é um registro efêmero de conexões; ele não guarda histórico de chat.

> **Implementação desta etapa:** [frontend — envio de `joinRoom` após abrir a conexão](../src/app/use-room-socket.ts#L86-L90); [backend — validação, associação à sala e publicação da presença](../src/lambdas/realtime.ts#L48-L57); [backend — consulta por sala e broadcast](../src/lambdas/realtime.ts#L18-L25).

## Como uma mensagem chega a outra pessoa

Ao enviar uma mensagem, o frontend gera um `clientMessageId` e manda o conteúdo:

```json
{
  "action": "sendMessage",
  "content": "Olá, Ada!",
  "clientMessageId": "message-..."
}
```

A Lambda valida se a conexão já entrou em uma sala e se o conteúdo respeita o limite. Depois consulta todas as conexões daquela sala no DynamoDB e usa o `ApiGatewayManagementApi.PostToConnection` para enviar o evento a cada `connectionId`.

```text
Aba de Kaio → API Gateway → Lambda realtime → DynamoDB (busca sala)
                                                   │
                  +--------------------------------+------------------------------+
                  v                                v                              v
              conexão Kaio                    conexão Ada                    conexão outra aba
                  │                                │                              │
                  └──────────── recebe `chatMessage` ─────────────────────────────┘
```

Cada navegador recebe algo assim:

```json
{
  "type": "chatMessage",
  "id": "message-...",
  "nickname": "Kaio",
  "content": "Olá, Ada!",
  "sentAt": "2026-09-04T22:10:00.000Z"
}
```

Se o envio para uma conexão retornar `GoneException`, ela já não existe. A Lambda remove esse `connectionId` do DynamoDB para evitar novas tentativas.

> **Implementação desta etapa:** [frontend — submit que chama `sendMessage`](../src/app/page.tsx#L14-L16); [frontend — serialização e envio JSON pelo socket](../src/app/use-room-socket.ts#L32-L36); [backend — validação e broadcast de `chatMessage`](../src/lambdas/realtime.ts#L65-L69); [backend — envio por conexão e limpeza após `GoneException`](../src/lambdas/realtime.ts#L13-L25); [backend — cliente do endpoint de gerenciamento do API Gateway](../src/lambdas/websocket-management.ts#L4-L10).

## Indicador de digitação

O indicador não envia uma mensagem a cada tecla.

1. Na primeira tecla, o frontend envia `{ "action": "typing", "isTyping": true }`.
2. Enquanto você continua digitando, o temporizador é renovado.
3. Após 1,2 segundo sem digitar, ao limpar o campo, enviar a mensagem ou sair da sala, o frontend envia `isTyping: false`.
4. Os outros navegadores removem o aviso. Como proteção adicional, cada aviso remoto expira localmente após 2,5 segundos se o evento de parada não chegar.

O próprio navegador ignora o evento de digitação do seu nickname. Por isso você vê quando **outra pessoa** está digitando, mas não vê a si mesmo.

> **Implementação desta etapa:** [frontend — campo de mensagem dispara a lógica de typing](../src/app/page.tsx#L15-L16); [frontend — debounce de 1,2 s e evento de parada](../src/app/use-room-socket.ts#L127-L141); [frontend — expiração remota e remoção do próprio nickname](../src/app/use-room-socket.ts#L51-L68); [backend — broadcast do evento `typing`](../src/lambdas/realtime.ts#L71-L74).

## Regras e limites importantes

| Campo | Regra |
| --- | --- |
| Sala | letras, números e hífens; até 32 caracteres. |
| Nickname | até 24 caracteres. |
| Mensagem | até 500 caracteres. |
| Payload WebSocket | até 2 KB. |
| Reconexão | o frontend tenta reconectar com espera crescente, até 10 segundos. |

Quando uma regra falha, a Lambda envia ao mesmo cliente um evento como este:

```json
{ "type": "error", "message": "A mensagem deve ter entre 1 e 500 caracteres." }
```

> **Implementação desta etapa:** [backend — limites e validações do payload](../src/lambdas/contracts.ts#L5-L22); [backend — falha convertida em evento `error` para o cliente](../src/lambdas/realtime.ts#L89-L92); [frontend — reconexão com espera progressiva](../src/app/use-room-socket.ts#L98-L108).

## Como testar com duas abas

1. Inicie o frontend com `npm run dev`.
2. Abra `http://localhost:3000` em duas abas.
3. Escolha a mesma sala e nicknames diferentes.
4. Envie uma mensagem em uma aba e veja o `chatMessage` chegar na outra.
5. Escreva em uma aba e pare; a outra mostra e remove o indicador de digitação.
6. Abra **Eventos recebidos** para observar os payloads JSON que chegam do servidor.

## O laboratório em ação

As imagens abaixo mostram a sequência sugerida para o teste local. Elas são capturas da própria aplicação, não diagramas externos.

### 1. Entrar na sala

![Tela de entrada do Realtime Rooms com nickname e sala](images/socket_1.png)

Preencha nickname e sala. Ao clicar em **Entrar na sala**, o frontend executa a abertura do WebSocket descrita em [Frontend — a função `connect` cria `new WebSocket(websocketEndpoint)`](../src/app/use-room-socket.ts#L75-L84).

### 2. Confirmar a conexão e a presença

![Sala conectada com participantes e eventos roomJoined e presenceUpdated](images/socket_2.png)

Depois de `joinRoom`, a lista **Na sala** é atualizada pelo evento `presenceUpdated`. Veja [Backend — validação, associação à sala e publicação da presença](../src/lambdas/realtime.ts#L48-L57).

### 3. Enviar a primeira mensagem

![Sala com uma mensagem e o evento chatMessage colorido no painel técnico](images/socket_3.png)

O painel técnico permite comparar a mensagem visível com o JSON `chatMessage` recebido. A distribuição para todas as conexões da sala acontece em [Backend — validação e broadcast de `chatMessage`](../src/lambdas/realtime.ts#L65-L69).

### 4. Adicionar outra pessoa à sala

![Sala com três participantes e eventos de presença](images/socket_4.png)

Abra uma terceira aba com outro nickname. A nova conexão gera uma atualização de presença para a sala inteira por meio de [Backend — consulta por sala e broadcast](../src/lambdas/realtime.ts#L18-L25).

### 5. Observar a conversa crescer

![Chat com várias mensagens e painel de eventos aberto](images/socket_5.png)

Cada mensagem é independente: o DynamoDB mantém conexões, não histórico. O feed é atualizado pelo navegador em [Frontend — interpretação e armazenamento de eventos recebidos](../src/app/use-room-socket.ts#L38-L73).

### 6. Inspecionar eventos de digitação e mensagens

![Chat com várias mensagens e eventos typing e chatMessage coloridos](images/socket_6.png)

O destaque de sintaxe permite identificar rapidamente chaves, strings, números e booleanos. A expiração do indicador de digitação é implementada em [Frontend — debounce de 1,2 s e evento de parada](../src/app/use-room-socket.ts#L127-L141).

O painel de eventos é uma ferramenta de estudo: ele mostra o protocolo da aplicação. O WebSocket transporta esses JSONs, mas os nomes `joinRoom`, `chatMessage` e `typing` são decisões deste projeto, não nomes obrigatórios do protocolo WebSocket.

> **Implementação desta etapa:** [frontend — interpretação e armazenamento de eventos recebidos](../src/app/use-room-socket.ts#L38-L73); [frontend — painel técnico com JSON colorido](../src/app/room-view.tsx#L17-L48).
