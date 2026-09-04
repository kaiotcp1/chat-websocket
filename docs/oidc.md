# OIDC e trust policy da pipeline

Este projeto não armazena chaves AWS no GitHub. A cada execução, o GitHub Actions pede um token OIDC de curta duração e a AWS permite que ele assuma a role `github-actions-deploy-role`.

## Fluxo

```text
GitHub Actions ── token OIDC temporário ──> AWS STS
GitHub Actions <─ credenciais temporárias ─ AWS role github-actions-deploy-role
```

**Implementação desta etapa:**

- [Workflow — solicita permissão para emitir o token OIDC](../.github/workflows/infrastructure.yml#L8-L10).
- [Workflow — assume a role AWS no job de plano](../.github/workflows/infrastructure.yml#L61-L65).
- [Workflow — assume a mesma role no job de apply](../.github/workflows/infrastructure.yml#L97-L101).

## O que a trust policy confere

A trust policy fica na role AWS compartilhada, fora deste repositório. Ela verifica quem emitiu o token e de qual repositório/branch ele veio. Neste projeto, as branches autorizadas são `main`, `develop` e `homolog`.

**Implementação desta etapa:**

- [Workflow — branches que disparam a pipeline](../.github/workflows/infrastructure.yml#L3-L6).
- [Workflow — validação explícita da branch autorizada](../.github/workflows/infrastructure.yml#L42-L50).
- [Template — exemplo de trust policy para adaptar à role AWS](oidc-trust-policy.json.template).

O template é apenas uma referência. Ele não é aplicado pelo Terraform e não deve ser incluído no destroy, porque a role de deploy é compartilhada entre projetos.

## Como relacionar a policy ao repositório

Abra o [template da trust policy](oidc-trust-policy.json.template) e ajuste o campo `sub` para o dono, repositório e branches corretos. Depois atualize a trust policy da role `github-actions-deploy-role` com uma credencial administrativa.

O workflow usa essa role apenas depois de o GitHub apresentar o token OIDC. Se a branch não coincidir com a condição `sub`, a AWS nega a operação antes que Terraform consiga acessar a conta.
