# DotCard-API — Divisão em Subtarefas

> Plano de execução derivado do **@ESCOPO.md**. Cada tarefa é uma unidade coerente, do tamanho de um PR.
> **42 tarefas em 9 fases.**
> Criado em 2026-08-07.

---

## Como ler

Cada tarefa traz **de que depende** e **como saber que terminou**. A ordem das fases respeita dependências reais — dentro de uma fase, tarefas sem dependência entre si podem ser feitas em paralelo.

O ESCOPO.md é a referência normativa: tipos de coluna, regras de negócio e justificativas estão lá, não repetidos aqui.

## Mapa de dependências

```
F0 infraestrutura ──┬──> F1 auth ──┬──> F2 catálogo ──┐
                    │              │                   ├──> F4 geração ──> F5 notificações
                    │              └──> F3 economia ───┘         │
                    │                                            │
                    └──────────────────> F6 amizades ──> F7 trocas
                                                                 │
                                                    F8 acabamento ┘
```

**Caminho crítico:** F0 → F1 → F3 → F4 → F7. As fases 2 e 6 podem correr em paralelo com o caminho crítico depois de F1.

---

## Fase 0 — Infraestrutura base

Sem isso nada roda. Toda a fase é pré-requisito do resto.

### 0.1 Scaffolding do projeto NestJS
Criar `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore` e a estrutura `src/{common,config,database,modules}`. Espelhar as versões e convenções do AuthForge (NestJS 11, TypeScript 5.7).
**Depende de:** nada.
**Pronto quando:** `npm run build` e `npm run lint` passam num `main.ts` mínimo.

### 0.2 Submodules dos serviços irmãos
`git submodule add` de AuthForge em `services/auth-forge` e MailForge em `services/mail-forge`, usando as URLs SSH da seção 16 do ESCOPO.
**Depende de:** nada.
**Pronto quando:** `git clone --recurse-submodules` num diretório limpo traz os três repositórios.

### 0.3 Módulo de configuração e validação de env
`ConfigModule` global + `env.validation.ts` com class-validator, falhando no boot se faltar variável. Criar `.env.example` cobrindo banco, JWT, RabbitMQ, MinIO e porta.
**Depende de:** 0.1.
**Pronto quando:** subir sem uma variável obrigatória derruba a aplicação com mensagem clara.

### 0.4 Conexão com o banco e infraestrutura de migrations
`data-source.ts`, `TypeOrmModule` assíncrono lendo do ConfigModule, e os scripts `migration:generate` / `migration:run` / `migration:revert` no `package.json`. `synchronize` sempre `false`.
**Depende de:** 0.3.
**Pronto quando:** `npm run migration:run` conecta e roda (mesmo sem migrations ainda).

### 0.5 Dockerfile
Multi-stage (deps → build → runtime), node:22-alpine, usuário não-root.
**Depende de:** 0.1.
**Pronto quando:** a imagem builda e o container sobe a API.

### 0.6 docker-compose raiz
Orquestrar: `dotcard-api`, `dotcard-postgres` (5433), `authforge-api` (3000), `authforge-postgres` (5432), `mailforge`, `rabbitmq` (5672/15672), `minio` (9000/9001). Rede compartilhada, healthchecks, e **comentário em cada bloco herdado apontando o compose de origem** do submodule.
**Depende de:** 0.2, 0.5.
**Pronto quando:** `docker compose up` sobe os sete containers e todos ficam saudáveis.

### 0.7 Health check
`GET /health` verificando Postgres e RabbitMQ. Público.
**Depende de:** 0.4.
**Pronto quando:** retorna 200 com os dois serviços de pé e 503 com o Postgres derrubado.

### 0.8 Bootstrap da aplicação
`main.ts` com prefixo global `/v1`, `ValidationPipe` global, Helmet, CORS, Swagger e exception filters.
**Depende de:** 0.3.
**Pronto quando:** `/v1/docs` abre o Swagger e um DTO inválido retorna 400 formatado.

---

## Fase 1 — Autenticação

### 1.1 Adicionar `name` ao JWT do AuthForge ⚠️ altera submodule
Incluir `name` em `AccessTokenPayload` e `AuthenticatedUser` (`src/common/interfaces/jwt-payload.interface.ts`) e preencher na assinatura do token (`src/modules/auth/services/auth.service.ts`). A coluna já existe na entidade `users` — não há migration. **É a única alteração em submodule de todo o projeto.**
**Depende de:** 0.2.
**Pronto quando:** um login no AuthForge devolve token cujo payload contém `name`. **Commitado e com push no repositório do AuthForge antes** de atualizar o ponteiro aqui.

### 1.2 Estratégia JWT e guards
`JwtStrategy` validando localmente com `JWT_SECRET`, escrita de forma que trocar para RS256 seja só variável de ambiente. Guard padrão global, decorator `@Public()` para exceções, `@Roles()` e `@CurrentUser()`.
**Depende de:** 0.8, 1.1.
**Pronto quando:** rota protegida rejeita sem token, aceita com token válido do AuthForge, e `@CurrentUser()` entrega `sub`, `email`, `name` e `roles`.

---

## Fase 2 — Catálogo

Paralelizável com a Fase 3.

### 2.1 Enums, entidades e migration do catálogo
Enums `rarity` e `card_type`; entidades `Collection` e `Card` conforme seções 5.1 e 5.2; índice composto `(collection_id, rarity)`; soft delete em `cards`.
**Depende de:** 0.4.
**Pronto quando:** a migration cria as duas tabelas com constraints e índices corretos.

### 2.2 Seed do catálogo
20–30 cartas de tema fantasia/RPG distribuídas nas 4 raridades, em 2 coleções. Incluir **de propósito** uma coleção sem cartas de alguma raridade, para exercitar a renormalização (4.2).
**Depende de:** 2.1.
**Pronto quando:** `npm run seed` popula e é idempotente.

### 2.3 Leitura do catálogo
`GET /v1/cards` paginado com filtros por coleção, raridade e tipo; `GET /v1/cards/:id`; `GET /v1/cards/types`; `GET /v1/collections`. Todos autenticados.
**Depende de:** 2.1, 1.2.
**Pronto quando:** filtros combinam corretamente e cartas com soft delete não aparecem.

### 2.4 Escrita do catálogo (admin)
`POST /v1/cards`, `PATCH /v1/cards/:id`, `DELETE /v1/cards/:id` (soft), todos exigindo role `ADMIN`.
**Depende de:** 2.3.
**Pronto quando:** usuário sem `ADMIN` recebe 403 e o delete apenas preenche `deleted_at`.

### 2.5 Módulo de storage (MinIO)
Cliente `@aws-sdk/client-s3` apontando para o MinIO, criação do bucket no boot, upload de imagem integrado ao CRUD. Persistir **`image_key`**, montando a URL na serialização do DTO a partir de `STORAGE_PUBLIC_URL`.
**Depende de:** 2.4, 0.6.
**Pronto quando:** upload grava o objeto, o banco guarda só a chave, e o DTO devolve URL completa e acessível.

---

## Fase 3 — Jogador e economia

Paralelizável com a Fase 2.

### 3.1 Entidades e migration de jogador e razão
Enum `balance_reason`; entidades `Player` e `BalanceTransaction` conforme seções 5.4 e 5.8; índice em `(user_id, created_at)`; unique em `friend_code`.
**Depende de:** 0.4.
**Pronto quando:** a migration cria as duas tabelas com constraints corretas.

### 3.2 Arquivo de configuração do jogo
Config tipada e versionada com: distribuição de raridades; tamanhos de pacote (1/5/10) e seus custos em DotPoints (1/5/10 — linear, 1 por carta); saldo inicial (10) e recarga diária (10). **Validação fail-fast no boot** exigindo soma exata de 100% nas probabilidades.
**Depende de:** 0.3.
**Pronto quando:** distribuição somando 99% impede a aplicação de subir, com mensagem explícita. Coberto por teste unitário.

### 3.3 Provisionamento preguiçoso do jogador
Criar a linha em `players` no primeiro acesso, a partir do JWT: gera `friend_code` único (8 caracteres, sem ambíguos, com retry em colisão), grava `display_name` e credita o saldo inicial com lançamento `INITIAL_GRANT`. Atualizar `display_name` a cada requisição.
**Depende de:** 3.1, 3.2, 1.2.
**Pronto quando:** primeiro acesso de um usuário novo cria player com código único e saldo, e o razão registra o crédito.

### 3.4 Serviço de carteira (DotPoints)
Recarga diária preguiçosa por `last_allowance_at` **completando o saldo até 10 sem acumular**, débito sob `SELECT ... FOR UPDATE`, e lançamento obrigatório em `balance_transactions` a cada movimento. Erro de saldo insuficiente.
**Depende de:** 3.3.
**Pronto quando:** duas requisições concorrentes não gastam o mesmo saldo duas vezes (teste com transações simultâneas); quem ficou 5 dias sem jogar volta com 10 DotPoints, não 50; e todo movimento tem lançamento correspondente.

### 3.5 Endpoint de perfil
`GET /v1/me` devolvendo saldo, `friend_code` e nome. `POST /v1/me/friend-code/rotate`.
**Depende de:** 3.3.
**Pronto quando:** a rotação gera código novo e único, invalidando o anterior.

---

## Fase 4 — Geração de cartas (núcleo do produto)

### 4.1 Entidade e migration de cartas geradas
`GeneratedCard` conforme seção 5.3: PK `bigint`, `pull_id`, CHECK `float_value > 0 AND < 1`, índices em `owner` e `pull_id`.
**Depende de:** 2.1, 3.1.
**Pronto quando:** a constraint rejeita float fora do intervalo aberto.

### 4.2 Motor de sorteio ⭐ **tarefa mais sensível do projeto**
Sorteio em dois passos (raridade pela distribuição → carta uniforme dentro de raridade+coleção), renormalização quando a raridade sorteada não tem cartas na coleção, `crypto.randomInt`, geração do float com o piso de `0.0000001`, e filtro `deleted_at IS NULL`.
**Depende de:** 3.2, 4.1.
**Pronto quando:** os testes unitários cobrirem — distribuição estatística aderente à config em amostra grande; renormalização com raridade vazia; **carta com soft delete nunca sorteada**; float sempre dentro de `(0,1)`.

### 4.3 Endpoint de abertura de pacote
`POST /v1/collections/:id/pulls` com tamanho ∈ {1,5,10} validado por enum. Transação única de 7 passos conforme seção 6 do ESCOPO: gera `pull_id`, trava o player, aplica recarga, valida e debita saldo, sorteia e insere as cartas, commita.
**Depende de:** 4.2, 3.4.
**Pronto quando:** um pull debita exatamente o custo configurado, todas as cartas compartilham o `pull_id`, e falha por saldo insuficiente não gera carta nem lançamento.

### 4.4 Consulta de acervo
`GET /v1/me/cards` paginado com filtros; `GET /v1/users/:id/cards` restrito a `ADMIN`.
**Depende de:** 4.1, 1.2.
**Pronto quando:** só retorna cartas cujo `owner` é o usuário do token (ou qualquer um, no caso admin).

---

## Fase 5 — Notificações

### 5.1 Publisher RabbitMQ
Cliente publicando em `mail.queue` com `noAssert: true`, no contrato `{ type, to, subject?, data }` do MailForge. **Best effort**: falha registra log e nunca propaga erro.
**Depende de:** 0.6, 0.3.
**Pronto quando:** com o RabbitMQ derrubado, a operação de origem continua funcionando normalmente.

### 5.2 Serviço de completude de coleção
Verifica se o usuário passou a possuir todas as cartas ativas de uma coleção e grava `collection_completions` (migration incluída) garantindo notificação única por par usuário+coleção.
**Depende de:** 4.1, 2.1.
**Pronto quando:** completar duas vezes (perdendo e recuperando carta) não gera segunda notificação.

### 5.3 Gatilhos de email
Após o commit do pull: carta `LEGENDARY` obtida e coleção completa, ambos via template `default-notification`, usando `email` e `name` do JWT.
**Depende de:** 5.1, 5.2, 4.3.
**Pronto quando:** pull lendário publica mensagem válida na fila e o MailForge a consome sem erro de validação.

---

## Fase 6 — Amizades

Paralelizável com as fases 4 e 5.

### 6.1 Entidade e migration de amizades
`Friendship` conforme seção 5.5, com **PK composta no par canônico ordenado** (`user_a = LEAST`, `user_b = GREATEST`).
**Depende de:** 3.1.
**Pronto quando:** tentar inserir a mesma relação em ordem invertida viola a PK.

### 6.2 Convite e aceite
`POST /v1/friends/invites` por `friend_code`, `POST /v1/friends/invites/:id/accept`, `DELETE /v1/friends/invites/:id` (recusa, apaga a linha). Tratar colisão de PK por convite mútuo como **aceite automático**.
**Depende de:** 6.1, 3.5.
**Pronto quando:** convite mútuo resulta em amizade `ACCEPTED` direto, sem erro.

### 6.3 Listagem e remoção
`GET /v1/friends` (amigos e convites pendentes, com `display_name`), `DELETE /v1/friends/:userId` (apaga a linha).
**Depende de:** 6.2.
**Pronto quando:** a listagem exibe nomes sem nenhuma chamada HTTP ao AuthForge.

---

## Fase 7 — Trocas

A fase mais delicada. Depende de amizades e de cartas geradas.

### 7.1 Entidades e migration de trocas
Enum `trade_status`; `TradeOffer` (seção 5.6) e `ActiveTradeLock` (seção 5.7, `user_id` como PK).
**Depende de:** 4.1, 6.1.
**Pronto quando:** a PK de `active_trade_locks` impede duas travas para o mesmo usuário.

### 7.2 Criação de proposta
`POST /v1/trades` com `toUserId` e `offeredCardId`. Valida amizade `ACCEPTED` (403 se não houver), posse da carta oferecida, e insere as **duas** linhas de trava na mesma transação.
**Depende de:** 7.1, 6.3.
**Pronto quando:** criar segunda proposta com qualquer um dos dois participantes já travado retorna 409; e não-amigo retorna 403.

### 7.3 Contraproposta
`POST /v1/trades/:id/counterpart`. Só o `to_user`, só em `AWAITING_COUNTERPART`. Valida posse da carta oferecida e avança para `AWAITING_CONFIRMATION`.
**Depende de:** 7.2.
**Pronto quando:** outro usuário que não o destinatário recebe 403, e estado inválido retorna 409.

### 7.4 Confirmação e execução ⭐ **transação crítica**
`POST /v1/trades/:id/confirm`. Só o `from_user`, só em `AWAITING_CONFIRMATION`. Numa transação: trava as duas cartas com `FOR UPDATE ORDER BY id`, revalida posse dos dois lados, troca os `owner`, marca `ACCEPTED` e remove as duas travas.
**Depende de:** 7.3.
**Pronto quando:** as duas cartas trocam de dono no mesmo commit, `pulled_by` e `float_value` permanecem intactos, e ambos os usuários ficam livres para novas trocas.

### 7.5 Cancelamento
`POST /v1/trades/:id/cancel`, disponível para **ambos** os participantes em qualquer estado não-terminal. Grava `cancelled_by` e libera as travas.
**Depende de:** 7.2.
**Pronto quando:** os dois lados conseguem cancelar nas duas fases, e as travas somem.

### 7.6 Expiração preguiçosa
Ao listar as próprias trocas ou tentar criar nova, proposta vencida vira `EXPIRED` e as travas são liberadas antes de prosseguir.
**Depende de:** 7.2.
**Pronto quando:** usuário travado por proposta vencida consegue criar uma nova sem intervenção manual.

### 7.7 Completude de coleção após troca
Rodar a verificação da 5.2 **para os dois usuários** após o commit da troca — quem completar recebendo cartas também é notificado.
**Depende de:** 7.4, 5.2.
**Pronto quando:** completar coleção via troca dispara a notificação.

### 7.8 Consulta de trocas
`GET /v1/trades` e `GET /v1/trades/:id`, restritos aos participantes.
**Depende de:** 7.2.
**Pronto quando:** terceiro não envolvido recebe 403.

---

## Fase 8 — Acabamento

### 8.1 Documentação Swagger completa
Anotar todos os endpoints com request, response, códigos de erro e exemplos.
**Depende de:** fases 2 a 7.

### 8.2 Testes end-to-end
Cobrir os fluxos completos: abrir pacote, virar amigos, negociar troca do início ao fim, e os caminhos de erro (saldo insuficiente, não-amigo, trava ativa).
**Depende de:** fases 2 a 7.

### 8.3 CI
GitHub Actions com lint, test e build.
**Depende de:** 8.2.

### 8.4 README
Como subir o ambiente, variáveis de ambiente, e a **disciplina de submodules** (clone recursivo, push no submodule antes do ponteiro, detached HEAD).
**Depende de:** 0.6.

---

## Pendências — todas fechadas

| Pendência | Decisão | Tarefas afetadas |
|---|---|---|
| **P1** — aquisição de moeda | DotPoints, 1 por carta, recarga diária de 10 sem acúmulo | 3.2, 3.4 |
| **P2** — sessão ativa | **Não implementada** — a janela de 15 min é aceita conscientemente | nenhuma |
| **P3** — livro-razão | `balance_transactions` | 3.1, 3.4 |
| **P4** — agrupamento de pacote | `pull_id` | 4.1, 4.3 |

P2 foi reavaliado e revertido em 2026-08-07: exigir sessão ativa custaria duas tarefas extras na Fase 1 e tornaria a abertura de pacote dependente do AuthForge estar de pé. Aceitou-se a janela de 15 minutos. Com isso, a Fase 1 volta a ter **uma única** alteração em submodule (`name` no JWT).

## Sugestão de execução

As fases 0 e 1 são sequenciais e destravam tudo. Depois delas, **2 e 3 correm em paralelo**, e **6 pode correr em paralelo com 4 e 5**. A fase 7 exige 4 e 6 concluídas.

As duas tarefas que merecem mais cuidado e revisão são a **4.2** (motor de sorteio — é onde um erro silencioso distorce o jogo inteiro) e a **7.4** (transação de troca — é onde um erro de concorrência duplica ou destrói patrimônio de jogador).
