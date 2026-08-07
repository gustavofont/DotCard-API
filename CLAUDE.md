# DotCard-API

Backend de um card game colecionável, e também o **repositório raiz do ambiente de backend**: agrega dois microsserviços genéricos via git submodules e sobe tudo com um `docker compose up`.

O escopo completo — modelo de dados, regras de negócio, decisões de arquitetura e o que ficou fora do MVP — está em **@ESCOPO.md**. Leia antes de propor mudanças estruturais.

## Restrição inegociável

**AuthForge e MailForge precisam continuar genéricos e reutilizáveis por outros projetos.** Nenhum vocabulário de card game (carta, coleção, raridade, pacote, troca) pode entrar no código deles. Se uma feature parecer exigir isso, o desenho está errado — resolva do lado do DotCard.

A única alteração prevista no AuthForge é adicionar `name` ao payload do JWT, que é genérica por natureza.

## Estrutura

```
DotCard-API/            ← repo raiz
├── docker-compose.yml  ← ambiente completo (fonte única de verdade)
├── src/                ← a API do jogo
└── services/
    ├── auth-forge/     ← git submodule
    └── mail-forge/     ← git submodule
```

| Serviço | Porta | Banco |
|---|---|---|
| DotCard-API | 3001 | Postgres `dotcard` (host 5433) |
| AuthForge | 3000 | Postgres `authforge` (host 5432) |
| MailForge | — | nenhum |
| RabbitMQ | 5672 / 15672 | — |
| MinIO | 9000 / 9001 | — |

## Submodules — disciplina obrigatória

Ao alterar qualquer arquivo em `services/`: **commite e dê push no repositório do próprio submodule antes** de commitar o ponteiro no repo raiz. Esquecer isso quebra o clone de todo mundo.

Clonar com `git clone --recurse-submodules`. Atenção a detached HEAD ao trabalhar dentro de um submodule.

## Stack

NestJS 11 + TypeScript, PostgreSQL + TypeORM com migrations versionadas, Swagger, class-validator, Jest. Estrutura de pastas espelha o AuthForge: `src/common/`, `src/config/`, `src/database/`, `src/modules/<domínio>/{controllers,services,entities,dto}`.

Respostas em DTO puro + exception filters do Nest — sem envelope customizado. Paginação offset/limit. Sem prefixo de versão na URL (removido em 2026-08-07, ver ESCOPO.md §3). Todo comportamento configurável vive em arquivos de config, nunca em constantes espalhadas.

## Invariantes de domínio

Decisões já fechadas e justificadas no ESCOPO.md. Não reabra sem motivo novo:

- **Sorteio em dois passos** — sorteia a raridade pela distribuição configurada, depois sorteia uniformemente uma carta dentro daquela raridade e coleção. Peso por carta distorce as porcentagens e foi o bug do protótipo anterior (`../dot-api`).
- **O algoritmo de sorteio precisa filtrar `deleted_at IS NULL`** — o catálogo usa soft delete.
- **Trocas são 1:1, dirigidas e só entre amigos.** Uma troca por vez trava **ambos** os participantes; a trava é garantida pela PK de `active_trade_locks`, não por checagem em código.
- **Quem propõe escolhe só a própria carta**; o destinatário oferece a contrapartida; o proponente tem a decisão final. Ambos podem cancelar a qualquer momento.
- **`generated_cards.owner` é o único campo mutável** de uma carta gerada. `pulled_by` e `float_value` são imutáveis para sempre.
- **Moeda é mecanismo de escassez, não marketplace.** Débito acontece na mesma transação do pull, sob `SELECT ... FOR UPDATE`.
- **`cards.image_key` guarda a chave do objeto, nunca a URL completa** — a URL é montada na serialização a partir de env.
- **Identificadores de usuário são UUIDs sem FK.** Bancos são independentes; integridade de usuário é responsabilidade do AuthForge.
- **`friend_code` é uma chave própria e rotacionável**, não o UUID do usuário.

## Integração entre serviços

- **Auth:** validação local do JWT com `JWT_SECRET` compartilhado (HS256), escrita de forma que migrar para RS256 seja só troca de env.
- **Email:** o DotCard é apenas **produtor**, publica em `mail.queue` com `noAssert: true` (o MailForge é dono da topologia) e usa exclusivamente o template `default-notification` existente. Entrega best effort — falha de notificação nunca faz o usuário perder uma carta.

## Pendências abertas

Quatro pontos ainda não fechados, detalhados na seção 15 do ESCOPO.md. **P1 (como o jogador adquire moeda) é bloqueante** para a jogabilidade.
