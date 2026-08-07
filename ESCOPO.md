# DotCard-API — Documento de Escopo

> Documento consolidado das decisões de arquitetura e requisitos.
> Substitui os arquivos de negociação `escopo(temporariooo).md` e `escopo2(temporario).md`, que permanecem no repositório apenas como registro do raciocínio.
>
> **Status:** escopo fechado, com 4 pendências explicitamente marcadas ao final.
> **Última atualização:** 2026-08-07

---

## 1. Visão geral

DotCard-API é o backend de um **card game colecionável**. O jogador gasta moeda do jogo para abrir pacotes, recebe cartas sorteadas aleatoriamente a partir de uma coleção, monta seu acervo e troca cartas com amigos.

O projeto é também o **repositório raiz do ambiente de backend**: ele agrega, via git submodules, dois microsserviços genéricos já existentes (autenticação e email) e sobe todo o ambiente com um único `docker compose up`.

### Restrição fundamental

**AuthForge e MailForge devem permanecer genéricos e reutilizáveis por outros projetos.** Nenhum vocabulário de card game pode vazar para dentro deles. Toda decisão neste documento respeita essa restrição — a única alteração prevista no AuthForge (adicionar `name` ao JWT) é genérica por natureza.

---

## 2. Arquitetura de serviços

```
DotCard-API/                       ← repositório raiz (este)
├── docker-compose.yml             ← sobe o ambiente completo
├── src/                           ← a API do jogo
└── services/
    ├── auth-forge/                ← git submodule (repo independente)
    └── mail-forge/                ← git submodule (repo independente)
```

| Serviço | Papel | Porta HTTP | Banco |
|---|---|---|---|
| **DotCard-API** | regras do jogo | 3001 | Postgres `dotcard` (host 5433) |
| **AuthForge** | autenticação/autorização | 3000 | Postgres `authforge` (host 5432) |
| **MailForge** | envio de email | — (só consumidor) | nenhum |
| **RabbitMQ** | broker compartilhado | 5672 / 15672 | — |
| **MinIO** | object storage (imagens) | 9000 / console 9001 | — |

- O `docker-compose.yml` da raiz é a **fonte única de verdade** para subir o ambiente completo. Os composes internos de cada submodule continuam existindo para uso standalone.
- O DotCard-API é o **dono do broker RabbitMQ** do ecossistema. O compose do projeto auxiliar `testMq` deixa de subir broker próprio.
- Como não usamos `include` do Docker Compose, o compose raiz **duplica** a definição dos containers dos submodules. Cada bloco deve trazer um comentário apontando o arquivo de origem, para reduzir o risco de divergência silenciosa.

### Submodules — disciplina obrigatória

Ao alterar qualquer arquivo dentro de `services/`, é obrigatório **commitar e dar push no repositório do próprio submodule antes** de commitar o ponteiro no repo raiz. Esquecer isso quebra o clone de qualquer outra pessoa. O README deve documentar: `git clone --recurse-submodules`, o risco de detached HEAD, e esse fluxo de push.

---

## 3. Stack

- **NestJS 11 + TypeScript** (mesma do AuthForge)
- **PostgreSQL + TypeORM**, com **migrations versionadas desde o dia 1**
- **Swagger** para documentação
- **class-validator** em DTOs e na validação de env no boot
- **Jest** — unitários no motor de sorteio e na config de raridade; e2e básico nos endpoints principais
- **Dockerfile multi-stage** (node:22-alpine, deps → build → runtime, usuário não-root)
- **CI**: lint + test + build
- Logger padrão do Nest com formato estruturado

> ⚠️ **Sem prefixo de versão na URL.** Chegou a ser adotado (`/v1`) e foi removido em 2026-08-07: sem cliente publicado ainda, o custo de reverter era zero, e a razão original (evitar breaking change simultâneo em todo consumidor) só se paga depois que existe consumidor de verdade. Se/quando isso mudar, reavaliar — mas versionar de URL não é a única opção (header `Accept-Version`, por exemplo, evita reescrever toda rota).

### Convenções

- Estrutura de pastas espelhando o AuthForge: `src/common/`, `src/config/`, `src/database/`, `src/modules/<domínio>/{controllers,services,entities,dto}`
- Respostas em **DTO puro** + exception filters do Nest (sem envelope customizado)
- Paginação **offset/limit**
- Todo comportamento configurável centralizado em arquivos de config — sem constantes espalhadas

### Fora de escopo agora

Correlation-id entre serviços, métricas (Prometheus), tracing (OpenTelemetry). Entram quando houver mais fluxos assíncronos que justifiquem.

---

## 4. Autenticação e autorização

**Validação local do JWT.** O DotCard replica a `JwtStrategy` do AuthForge e valida o token com `JWT_SECRET` compartilhado (HS256). Sem latência extra, sem chamada HTTP, sem credencial M2M.

O código deve ser escrito de forma que migrar para **RS256** seja apenas troca de variável de ambiente — o AuthForge já suporta `JWT_PUBLIC_KEY`/`JWT_PRIVATE_KEY`.

**Payload do token** (`AccessTokenPayload`): `sub` (UUID), `email`, `name`, `roles[]`, `permissions[]`.

> ⚠️ **`name` é a única alteração necessária no AuthForge.** A coluna `name` já existe na entidade `users`; falta apenas incluí-la em `src/common/interfaces/jwt-payload.interface.ts` e no ponto de assinatura em `src/modules/auth/services/auth.service.ts`. Zero migration. É uma melhoria genérica que beneficia qualquer consumidor do AuthForge.

**Autorização:** reaproveita as roles existentes (`ADMIN`, `MANAGER`, `USER`). Escrita no catálogo exige `ADMIN`; leitura e jogo exigem apenas usuário autenticado. Não são criadas permissions novas no AuthForge.

**Identidade do usuário:** o DotCard armazena o UUID vindo do `sub`, **sem foreign key** — bancos são independentes. A integridade referencial de usuário é responsabilidade exclusiva do AuthForge.

### Revogação de sessão

**O token é aceito enquanto válido, sem checagem de sessão ativa**, em todas as rotas — inclusive nas que movimentam patrimônio (abrir pacote, criar e confirmar troca). A janela de risco é o TTL do access token: até 15 minutos após um logout.

Decisão consciente, tomada em 2026-08-07 depois de avaliar a alternativa. Exigir sessão ativa custaria duas alterações extras no AuthForge — `sessionId` no payload do access token (hoje só o refresh token o carrega, então não há como identificar *qual* sessão validar) e um endpoint de introspecção — além de tornar a abertura de pacote, o endpoint mais quente do jogo, dependente de o AuthForge estar de pé.

Avaliou-se que a complexidade e o acoplamento não se justificam para o risco em questão. Caminho de mitigação disponível sem mudança estrutural: reduzir o TTL do access token no AuthForge.

---

## 5. Modelo de dados

O banco `dotcard` tem **9 tabelas** e **4 enums**.

### Enums

| Enum | Valores |
|---|---|
| `rarity` | `COMMON`, `RARE`, `EPIC`, `LEGENDARY` |
| `card_type` | `CREATURE`, `LAND`, `SORCERY`, `ARTIFACT` |
| `trade_status` | `AWAITING_COUNTERPART`, `AWAITING_CONFIRMATION`, `ACCEPTED`, `CANCELLED`, `EXPIRED` |
| `balance_reason` | `INITIAL_GRANT`, `DAILY_ALLOWANCE`, `PACK_PURCHASE` |

`rarity` é definido em código como enum TypeScript e é a **fonte única de verdade** compartilhada com o arquivo de configuração de probabilidades.

### 5.1 `collections` — coleções

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int` PK | |
| `name` | `varchar(255)` | único |
| `created_at` / `updated_at` | `timestamptz` | |

Populada apenas por seed no MVP — sem CRUD.

### 5.2 `cards` — catálogo (base de cartas)

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `int` PK | |
| `name` | `varchar(255)` | |
| `type` | `card_type` | |
| `collection_id` | `int` FK → `collections.id` | |
| `rarity` | `rarity` | |
| `image_key` | `varchar(512)` NULL | chave do objeto no storage, **não** URL |
| `created_at` / `updated_at` | `timestamptz` | |
| `deleted_at` | `timestamptz` NULL | soft delete |

Índice composto em `(collection_id, rarity)` — é exatamente a query do sorteio.

> ⚠️ O algoritmo de sorteio **deve** filtrar `deleted_at IS NULL`. Esquecer isso faz cartas removidas continuarem saindo em pacotes. Exige teste unitário dedicado.

### 5.3 `generated_cards` — exemplares dos jogadores

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` PK | |
| `card_id` | `int` FK → `cards.id` | |
| `owner` | `uuid` | **único campo mutável** — muda em trocas |
| `pulled_by` | `uuid` | imutável — quem sorteou originalmente |
| `float_value` | `numeric(8,7)` | CHECK `> 0 AND < 1` |
| `pull_id` | `uuid` | agrupa as cartas abertas no mesmo pacote |
| `created_at` | `timestamptz` | |

Índice em `owner` e em `pull_id`. UUIDs sem FK.

**Por que `bigint`:** há FK de `trade_offers` apontando para cá. Migrar o tipo da PK depois exigiria reescrita da tabela e atualização das FKs, com downtime.

**Por que `pull_id`:** com pacotes de 5 e 10 cartas, agrupar por `created_at` é frágil. Todas as cartas do mesmo pacote recebem o mesmo UUID, gerado no início da transação do pull. Permite a tela de "abri este pacote e saiu isto". Adicionar depois seria trivial, mas as cartas já geradas ficariam sem agrupamento retroativo.

**Papel do `float_value`:** atributo cosmético que dá identidade única a cada exemplar (estilo "float" de skin de CS:GO). Não afeta gameplay. Duas cópias da mesma carta base se distinguem por ele.

### 5.4 `players` — visão local do jogador

| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | `uuid` PK | vem do AuthForge, sem FK |
| `friend_code` | `varchar(8)` UNIQUE | chave pública de convite, rotacionável |
| `display_name` | `varchar(255)` | cache do `name` do JWT |
| `balance` | `bigint` | saldo de moeda |
| `last_allowance_at` | `timestamptz` | controle da recarga diária |
| `created_at` / `updated_at` | `timestamptz` | |

A linha é criada preguiçosamente no primeiro acesso do usuário, a partir do JWT.

**Por que cachear `display_name`:** o JWT traz o nome apenas do usuário autenticado. Para listar amigos com nome, o DotCard precisaria de nomes de terceiros — e buscá-los no AuthForge exigiria autenticação M2M. Como todo usuário grava o próprio nome ao interagir, a listagem vira leitura local. O nome pode ficar levemente desatualizado; corrige sozinho no próximo acesso da pessoa.

### 5.5 `friendships` — amizades

| Coluna | Tipo | Notas |
|---|---|---|
| `user_a` | `uuid` | `LEAST(uuid1, uuid2)` |
| `user_b` | `uuid` | `GREATEST(uuid1, uuid2)` |
| `requested_by` | `uuid` | quem enviou o convite |
| `status` | enum `PENDING` \| `ACCEPTED` | |
| `created_at` / `responded_at` | `timestamptz` | |
| | | **PK composta `(user_a, user_b)`** |

**Par canônico ordenado** resolve três problemas sem código de verificação: impede relação duplicada, impede convites cruzados virarem duas linhas, e torna "somos amigos?" uma leitura direta por PK.

`requested_by` é necessário porque a ordenação descarta quem convidou — e só o destinatário pode aceitar.

Se B convidar A enquanto o convite de A está `PENDING`, o insert colide com a PK: o caso é tratado como **aceite automático** (convite mútuo).

### 5.6 `trade_offers` — propostas de troca

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` PK | |
| `from_user` | `uuid` | quem propôs |
| `to_user` | `uuid` | destinatário (proposta é sempre dirigida) |
| `offered_card_id` | `bigint` FK → `generated_cards.id` NOT NULL | escolhida por `from_user` |
| `requested_card_id` | `bigint` FK → `generated_cards.id` NULL | escolhida por `to_user` |
| `status` | `trade_status` | |
| `cancelled_by` | `uuid` NULL | quem interrompeu |
| `expires_at` | `timestamptz` | prazo único, padrão 7 dias |
| `created_at` / `countered_at` / `resolved_at` | `timestamptz` | |

Troca é **estritamente 1 carta por 1 carta** — por isso não existe tabela de itens. `requested_card_id` nascer `NULL` é o que representa a fase 1 da negociação.

### 5.7 `active_trade_locks` — trava de troca

| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | `uuid` **PK** | |
| `trade_offer_id` | `bigint` FK → `trade_offers.id` | |
| `locked_at` | `timestamptz` | |

Ao criar uma proposta, insere **duas linhas** (uma por participante) na mesma transação. A PK em `user_id` faz o próprio banco rejeitar qualquer segunda proposta simultânea, sem depender de checagem em código (que teria corrida). Ao resolver a proposta, as duas linhas são apagadas.

Índices parciais em `from_user`/`to_user` não bastam: não impediriam o mesmo usuário de ser remetente numa proposta e destinatário em outra.

### 5.8 `balance_transactions` — livro-razão da moeda

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `bigint` PK | |
| `user_id` | `uuid` | |
| `amount` | `bigint` | positivo = crédito, negativo = débito |
| `balance_after` | `bigint` | saldo resultante, para auditoria |
| `reason` | enum `INITIAL_GRANT` \| `DAILY_ALLOWANCE` \| `PACK_PURCHASE` | |
| `pull_id` | `uuid` NULL | preenchido quando `reason = PACK_PURCHASE` |
| `created_at` | `timestamptz` | |

Índice em `(user_id, created_at)`.

Toda alteração de `players.balance` grava uma linha aqui, **na mesma transação**. Sem isso, o saldo é um número sobrescrito sem histórico: não há como auditar a economia nem responder "por que meu saldo caiu". O `pull_id` liga a cobrança às cartas que ela gerou.

Adicionar depois seria simples, mas o histórico anterior estaria perdido — movimentos não gravados não se reconstroem.

### 5.9 `collection_completions` — idempotência de notificação

| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | `uuid` | PK composta |
| `collection_id` | `int` FK → `collections.id` | PK composta |
| `completed_at` | `timestamptz` | |

Garante que o email de "coleção completa" saia **uma única vez** por par usuário+coleção. Se um admin adicionar cartas ao catálogo depois, o usuário não é re-notificado ao recompletar — preserva a semântica de conquista.

### Relacionamentos

```
collections ─1:N─> cards ─1:N─> generated_cards ─┬─> trade_offers.offered_card_id
     │                                            └─> trade_offers.requested_card_id
     └─1:N─> collection_completions

players             (1:1 com usuário)
balance_transactions (N:1 com usuário; ligada ao pull por pull_id)
friendships         (par de usuários)
active_trade_locks  (1:1 com usuário, transitória)
```

Fronteira com o AuthForge: todos os campos de usuário são UUIDs **sem FK**.

---

## 6. Geração de cartas (gacha)

### Configuração

Arquivo dedicado e versionado no git, tipado em TypeScript, contendo:

- **distribuição de raridades** — global, ex.: `COMMON 60%`, `RARE 25%`, `EPIC 14%`, `LEGENDARY 1%`
- **tamanhos de pacote** — 1, 5 e 10 cartas
- **custo em moeda** de cada tamanho de pacote (permite desconto por volume)
- **saldo inicial** e **recarga diária**

A estrutura já nasce preparada para virar mapa por coleção, sem quebrar a API.

**Fail-fast no boot:** se a soma das probabilidades não for exatamente 100%, a aplicação não sobe. Mesmo padrão do `env.validation.ts` do AuthForge.

### Algoritmo

**Sorteio em dois passos:**

1. Sorteia a **raridade** pela distribuição configurada.
2. Sorteia **uniformemente** uma carta daquela raridade dentro da coleção escolhida.

Essa ordem é o que faz "lendária = 1%" significar literalmente 1%. O protótipo anterior (`../dot-api`) usava peso por carta, o que distorcia as porcentagens conforme a quantidade de cartas de cada raridade — **não repetir**.

**Raridade sem cartas na coleção:** re-sorteia excluindo as raridades vazias e renormaliza as probabilidades restantes. Mantém o jogo funcional com coleções incompletas.

**Aleatoriedade:** `crypto.randomInt` — há economia real (cartas negociáveis obtidas com recurso limitado).

**Float:** `numeric(8,7)`, intervalo aberto `(0,1)`. Se o valor arredondado para 7 casas resultar em `0`, usar o menor valor representável (`0.0000001`). CHECK constraint no banco garante a regra independente do código.

**Duplicatas:** permitidas — cada pull é independente, e o float distingue os exemplares.

### Transação do pull

Tudo num único commit (6 passos — não aplica recarga, ver §7):

1. Gera o `pull_id` (UUID) que identificará este pacote
2. `SELECT ... FOR UPDATE` na linha do jogador em `players`
3. Valida saldo suficiente contra o saldo atual; se não, erro (`402`/`409` — o jogador precisa resgatar primeiro em `POST /me/daily-reward/claim`)
4. Debita o custo do pacote — gravando `balance_transactions` com `PACK_PURCHASE` e o `pull_id`
5. Sorteia e insere as N cartas, todas com o mesmo `pull_id`
6. Commit

Após o commit, fora da transação: verifica completude de coleção e publica notificações (best effort).

**Sem sistema de pity** no MVP.

---

## 7. Economia — DotPoints

A moeda do jogo chama-se **DotPoints**. Ela existe como **mecanismo de escassez**, não como marketplace: limita quantos pacotes o jogador abre por dia, o que é o que dá sentido às trocas.

### Preços e renda

Preço linear de **1 DotPoint por carta**:

| Pacote | Custo |
|---|---|
| 1 carta | 1 DotPoint |
| 5 cartas | 5 DotPoints |
| 10 cartas | 10 DotPoints |

**Recarga diária: 10 DotPoints** — o suficiente para dois pacotes de 5, ou um de 10, ou dez de 1. Em qualquer combinação, o teto é **10 cartas por dia**.

O saldo inicial, na criação do `players`, é igual à recarga diária (10 DotPoints), lançado como `INITIAL_GRANT`.

Como o preço é linear, pacotes maiores são conveniência, não vantagem econômica — não há desconto por volume.

### Semântica da recarga

A recarga **completa o saldo até 10, sem acumular**. Quem não resgata por uma semana não acumula 70 DotPoints; ao resgatar, tem 10. É o modelo clássico de energia diária, e é o que preserva a escassez que justifica as trocas.

✅ **DECISÃO (2026-08-08): resgate é uma ação explícita do jogador, não automática.** A recarga não é aplicada silenciosamente em nenhum outro endpoint — nem no `GET /me`, nem no pull. O jogador precisa chamar `POST /me/daily-reward/claim` para receber os DotPoints do dia. É a mecânica clássica de "recompensa diária" de jogos com energia/moeda regenerável, escolhida deliberadamente para criar um motivo de engajamento ativo (o jogador volta todo dia para resgatar), não só de consumo passivo.

Regras:
- Disponível quando `last_allowance_at` é de um dia anterior (ou nulo). Chamar fora dessa janela retorna `409 Conflict`.
- Resgatar sempre **completa até 10, nunca acumula** — mesmo depois de vários dias sem resgatar, o crédito é sempre até o teto, nunca soma os dias perdidos.
- `GET /me` expõe se o resgate está disponível hoje (`dailyRewardAvailable: boolean`) para o frontend decidir se mostra o botão, mas **não aplica a recarga** — é leitura pura, sem efeito colateral.
- O saldo **inicial** (`INITIAL_GRANT`, na criação do `players`) continua automático — é um grant único de boas-vindas, não faz parte da mecânica de resgate diário.
- O pull **não aplica recarga nenhuma**: debita sobre o saldo atual tal como está. Se o jogador não resgatou hoje e o saldo não cobre o pacote, o erro de saldo insuficiente (`402`/`409`) é a sinalização para resgatar primeiro.

**Considerado e descartado:** aplicar a recarga automaticamente (no pull e/ou no `GET /me`), e forçar reautenticação diária para garantir que o cliente sempre revisitasse um endpoint "fresco". A primeira opção removeria o gancho de engajamento que a mecânica de resgate existe para criar; a segunda exigiria mexer em semântica de sessão do AuthForge (fora do que ele deve saber — seria vocabulário de jogo vazando para um serviço genérico) e ainda não garantiria, por si só, que o resgate fosse chamado.

### Regras invariantes

- Saldo vive em `players.balance`, sempre inteiro.
- Débito acontece na mesma transação da geração, sob `SELECT ... FOR UPDATE`, evitando gasto duplo por requisições simultâneas.
- Resgate também trava a linha do jogador sob `SELECT ... FOR UPDATE`, pelo mesmo motivo — dois cliques em "resgatar" simultâneos não podem creditar duas vezes.
- **Toda** alteração de saldo grava uma linha em `balance_transactions` na mesma transação — o saldo nunca muda sem rastro.
- Preços, recarga e saldo inicial ficam no arquivo de configuração do jogo, ajustáveis sem tocar em código.

Fora de escopo: compra de DotPoints com dinheiro real, marketplace, venda de cartas de volta ao sistema.

---

## 8. Amizades

Trocas só acontecem entre amigos.

**Convite por `friend_code`** — 8 caracteres alfanuméricos maiúsculos, sem caracteres ambíguos (`O`/`0`, `I`/`1`), ex.: `K7X4M2QP`. Gerado com `crypto`, `UNIQUE` no banco, com retry em colisão, e **rotacionável** por endpoint dedicado.

**Por que não usar o UUID como código:** não é questão de segurança — os UUIDs do AuthForge são v4 aleatórios, portanto não enumeráveis. Os motivos são outros: 36 caracteres são impraticáveis de digitar ou ditar; o UUID é PK em todo o sistema e **nunca poderia ser rotacionado** se vazasse como código público (a rotação é justamente a defesa contra spam de convites); e transformar o identificador interno do AuthForge em elemento de UX pública do DotCard cria acoplamento indevido entre os serviços.

**Fluxo:** convite → aceite. Recusar ou desfazer amizade **apaga a linha**, sem estado morto, permitindo novo convite no futuro. Sem `BLOCKED` no MVP — se o spam virar problema real, a rotação do código já é a primeira defesa.

---

## 9. Trocas

### Regras

- **1 carta por 1 carta**, sempre.
- **Proposta dirigida** — `from_user` escolhe explicitamente o destinatário. Sem mural aberto.
- **Só entre amigos** — validado na criação da proposta (`403` se não houver amizade `ACCEPTED`).
- **Uma troca por vez, por usuário** — a proposta trava **ambos** os participantes até ser resolvida.
- **Ambos podem cancelar a qualquer momento**, unilateralmente, em qualquer estado não-terminal.

### Máquina de estados

```
User1 cria a proposta e escolhe SUA carta
        │
        ▼
  AWAITING_COUNTERPART ──────► qualquer um cancela ──► CANCELLED
        │
        │ User2 escolhe a carta dele
        ▼
  AWAITING_CONFIRMATION ─────► qualquer um cancela ──► CANCELLED
        │
        │ User1 confirma (decisão final)
        ▼
     ACCEPTED  →  troca executada
```

Quem propõe **não escolhe** o que quer receber; quem recebe é que oferece a contrapartida. Por isso a etapa final de confirmação existe — User1 precisa aprovar algo que não escolheu.

### Validação de posse

Acontece três vezes: na criação (`offered_card.owner = from_user`), na contraproposta (`requested_card.owner = to_user`) e na confirmação (revalida ambas sob `SELECT ... FOR UPDATE`, em ordem determinística por `id` para evitar deadlock).

Como os dois usuários ficam travados desde a criação e **não existe nenhum outro mecanismo de transferência de cartas no MVP**, a posse não pode mudar durante a negociação. A revalidação final é rede de segurança que, na prática, nunca deve falhar.

### Execução

Numa única transação: trava as duas linhas de `generated_cards`, revalida, troca os dois `owner`, marca a proposta como `ACCEPTED`, apaga as duas linhas de `active_trade_locks`.

Após o commit: verifica completude de coleção **para os dois usuários** e publica notificações.

### Expiração

Prazo único e generoso (padrão 7 dias), contado da criação, **sem renovação por etapa**. Expiração preguiçosa: uma proposta vencida é marcada `EXPIRED` e as travas liberadas quando alguém consulta as próprias trocas ou tenta criar uma nova — sem necessidade de cron.

A expiração é apenas **higiene de dados**, não válvula de escape: como qualquer um dos dois pode cancelar a qualquer momento, nenhum usuário ativo fica preso.

### Procedência

`generated_cards` guarda só o dono atual. O histórico completo de cada exemplar é reconstruível por `pulled_by` (origem) + as `trade_offers` com status `ACCEPTED` que a referenciam, ordenadas por `resolved_at`. Nenhuma tabela de auditoria adicional é necessária.

---

## 10. Notificações por email

O DotCard é **apenas produtor** no RabbitMQ. Ele publica na fila `mail.queue`, que já pertence ao MailForge, usando `noAssert: true` — o MailForge é dono da topologia (exchange, retry TTL, DLQ) e o DotCard não deve redeclará-la.

**Template:** exclusivamente o `default-notification` já existente (`name`, `title`, `message`). Nenhum template novo é criado — é o que mantém o MailForge livre de vocabulário de card game.

**Gatilhos:**

| Evento | Quando |
|---|---|
| Carta lendária obtida | pull resulta em carta `LEGENDARY` |
| Coleção completa | usuário passa a possuir todas as cartas de uma coleção, via pull **ou** troca |

Destinatário e nome vêm direto do payload do JWT (`email`, `name`) — sem chamada HTTP ao AuthForge.

**Entrega best effort:** se a publicação falhar, registra log e segue. O usuário nunca perde uma carta por falha de notificação. Sem outbox pattern no MVP.

Sem preferências/opt-in de notificação.

O DotCard **não consome** nada do RabbitMQ e **não declara filas próprias**. Convenção `dotcard.*` fica para quando houver necessidade real de consumo.

---

## 11. Armazenamento de imagens

**MinIO** (S3-compatible) como container no compose raiz. O backend usa `@aws-sdk/client-s3`; em produção troca-se apenas endpoint e credenciais para S3/R2 real, sem mudança de código.

`cards.image_key` guarda **apenas a chave do objeto** (ex.: `cards/abc.png`). A URL completa é montada na serialização do DTO a partir de env (`STORAGE_PUBLIC_URL`). Guardar a URL completa quebraria ao trocar de ambiente ou de provider.

Bucket **público para leitura** — imagens de carta não são dado sensível, e presigned URLs complicariam cache sem ganho. Escrita restrita ao backend.

Upload integrado ao CRUD administrativo de cartas.

---

## 12. API

Sem prefixo de versão na URL (ver seção 3). Todos exigem autenticação, salvo indicação contrária.

### Catálogo

| Método | Rota | Acesso |
|---|---|---|
| `GET` | `/cards` | autenticado — paginado, filtros por coleção/raridade/tipo |
| `GET` | `/cards/:id` | autenticado |
| `GET` | `/cards/types` | autenticado |
| `POST` | `/cards` | **ADMIN** |
| `PATCH` | `/cards/:id` | **ADMIN** |
| `DELETE` | `/cards/:id` | **ADMIN** — soft delete |
| `GET` | `/collections` | autenticado |

### Jogo

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/collections/:id/pulls` | abre pacote (body: tamanho ∈ {1,5,10}) — não aplica recarga, debita o saldo atual |
| `GET` | `/me` | perfil: saldo, `friend_code`, nome, `dailyRewardAvailable` |
| `POST` | `/me/daily-reward/claim` | resgata a recarga diária — `409` se já resgatado hoje |
| `GET` | `/me/cards` | acervo próprio, paginado |
| `GET` | `/users/:id/cards` | **ADMIN** — acervo de terceiro |
| `POST` | `/me/friend-code/rotate` | gera novo código |

O `userId` **sempre** vem do token, nunca do body.

### Amizades

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/friends` | lista amigos e convites pendentes |
| `POST` | `/friends/invites` | convida por `friendCode` |
| `POST` | `/friends/invites/:id/accept` | aceita |
| `DELETE` | `/friends/invites/:id` | recusa |
| `DELETE` | `/friends/:userId` | desfaz amizade |

### Trocas

| Método | Rota | Quem pode |
|---|---|---|
| `GET` | `/trades` | participantes |
| `GET` | `/trades/:id` | participantes |
| `POST` | `/trades` | cria (body: `toUserId`, `offeredCardId`) |
| `POST` | `/trades/:id/counterpart` | `to_user` — escolhe sua carta |
| `POST` | `/trades/:id/confirm` | `from_user` — decisão final |
| `POST` | `/trades/:id/cancel` | **ambos**, a qualquer momento |

### Operacional

| Método | Rota | Acesso |
|---|---|---|
| `GET` | `/health` | público — verifica Postgres e RabbitMQ |

---

## 13. Seed

Dados fictícios de tema fantasia/RPG: ~20–30 cartas distribuídas nas 4 raridades, em 1–2 coleções de exemplo. Suficiente para exercitar o sorteio ponta a ponta, inclusive o caso de raridade vazia.

---

## 14. Fora do MVP

Registrado explicitamente para não ser reaberto sem decisão consciente:

- Marketplace, compra de moeda com dinheiro real, venda de carta ao sistema
- Decks e mecânica de partida/batalha — o jogo é, por ora, apenas colecionável
- Queimar/descartar carta; inventário com stack
- Achievements e leaderboard
- Coleções sazonais e eventos temporários
- Sistema de pity
- Trocas com mais de uma carta por lado; trocas envolvendo moeda; mural aberto de propostas
- Preferências/opt-in de notificação
- CRUD de coleções (apenas seed)
- PATCH/DELETE de cartas geradas
- Bloqueio de usuário (`BLOCKED` em amizades)
- Correlation-id, métricas, tracing

---

## 15. Pendências

**Nenhuma pendência aberta.** As quatro foram fechadas em 2026-08-07 e incorporadas ao documento:

| | Decisão | Onde ficou |
|---|---|---|
| **P1** | DotPoints, 1 por carta, recarga diária de 10 sem acúmulo | Seção 7 |
| **P2** | Sem checagem de sessão — a janela de 15 min é aceita | Seção 4 |
| **P3** | `balance_transactions` — livro-razão | Seção 5.8 |
| **P4** | `pull_id` agrupando as cartas do pacote | Seção 5.3 |

Com P2 resolvido por aceitação do risco, o AuthForge recebe **uma única alteração** em todo o projeto: `name` no payload do JWT.

Os valores de balanceamento (preço, recarga, saldo inicial) vivem no arquivo de configuração e podem ser ajustados com o jogo rodando, sem tocar em código.

---

## 16. Configuração do repositório

Verificado em 2026-08-07 — os três repositórios estão prontos para a montagem dos submodules:

| Repositório | Remote | Estado |
|---|---|---|
| DotCard-API | `git@github.com:gustavofont/DotCard-API.git` | sincronizado |
| AuthForge | `git@github.com:gustavofont/AuthForge.git` | sincronizado |
| MailForge | `git@github.com:gustavofont/MailForge.git` | sincronizado |

Os submodules serão adicionados a partir das URLs SSH acima, em `services/auth-forge` e `services/mail-forge`.
