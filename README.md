# Realtime Rooms

Projeto de portfólio para praticar API Gateway WebSocket, Lambda, DynamoDB, Terraform e CI/CD com GitHub Actions usando OIDC.

O frontend permite que duas ou mais pessoas entrem na mesma sala, enviem mensagens, visualizem participantes e acompanhem eventos WebSocket em tempo real.

## Executar o frontend localmente

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Defina `NEXT_PUBLIC_WS_URL` no `.env.local` com o output `websocket_url` do Terraform. Abra duas janelas do navegador, entre na mesma sala e envie mensagens entre elas.

## Validar e gerar os pacotes

```powershell
npm run lint
npm test
npm run build:lambda
npm run build
terraform -chdir=infra init
terraform -chdir=infra validate
```

Após um apply, execute o smoke test para validar duas conexões entrando na mesma sala e recebendo um broadcast:

```powershell
npm run smoke:websocket -- "$(terraform -chdir=infra output -raw websocket_url)"
```

## Infraestrutura e state Terraform

O backend provisiona uma API WebSocket, duas Lambdas, uma tabela DynamoDB para conexões, IAM específico e logs do CloudWatch.

O bucket compartilhado `terraform-states-761018861028-us-east-1` é usado exclusivamente como backend remoto, com a chave `websocket-message/prod/terraform.tfstate`. Ele não é um recurso gerenciado por este repositório e nunca será removido pelo workflow de destroy.

## Pipeline GitHub Actions

O workflow **Infrastructure** é manual e aceita dois booleanos:

- `apply=true`: cria ou atualiza a infraestrutura usando o plano salvo.
- `destroy=true`: remove somente os recursos desta aplicação usando um plano de destruição salvo.
- Ambos como `false`: valida e gera apenas o plano.
- Ambos como `true`: falha no preflight.

O workflow só pode executar a partir de `main`, `develop` ou `homolog`, que são as branches aceitas pela trust policy OIDC atual da role de deploy.

## Configuração necessária antes do primeiro deploy

1. Crie o repositório GitHub e envie o código para uma das branches autorizadas.
2. Confirme que a trust policy da role `arn:aws:iam::761018861028:role/github-actions-deploy-role` permite a branch usada. Caso a policy seja restringida para este repositório, use [docs/oidc-trust-policy.json.template](docs/oidc-trust-policy.json.template) como referência.
3. Confirme que a role possui acesso aos recursos de `infra/`, ao state `websocket-message/prod/terraform.tfstate` e ao arquivo de lock `.tflock` no bucket compartilhado.

O pipeline usa OIDC e credenciais temporárias; não use access keys da AWS como secrets no GitHub.
