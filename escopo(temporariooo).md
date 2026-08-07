# Perguntas de arquitetura — DotCard-API

> Cada pergunta já vem preenchida com a resposta que considero mais adequada (marcada com 💡).
> Para validar, deixe como está. Para discordar, **apague e escreva sua resposta** no lugar.
> Prioridade: blocos **2, 3, 4 e 6** são bloqueantes.

---

## 1. Stack tecnológica

**1.1** Confirma NestJS 11 + TypeScript + Postgres + TypeORM (mesma stack do AuthForge)?
> 💡 Sim. Mesma stack do AuthForge — reaproveita guards, config de env, Dockerfile e padrão de módulos já validados.

**1.2** Copiar a estrutura de pastas do AuthForge (`src/modules/<domínio>/{controllers,services,entities,dto}`)?
> 💡 Sim, mesma estrutura (`common/`, `config/`, `database/`, `modules/<domínio>/...`) para consistência entre os 3 serviços.

**1.3** Migrations versionadas desde o dia 1, ou `synchronize:true` em dev?
> 💡 Migrations versionadas desde o dia 1 (como o AuthForge). Existe seed de catálogo, então `synchronize` é arriscado.

**1.4** Nível de testes no MVP: só unitários do gerador/gacha, ou também e2e?
> 💡 Unitários para o algoritmo de sorteio e validação da config de raridade (é a lógica mais sensível a bug), + e2e básico dos endpoints principais (CRUD de cartas e geração). Sem cobertura exaustiva no MVP.

**1.5** Swagger, sim/não?
> 💡 Sim, igual ao AuthForge.

---

## 2. Autenticação — integração com AuthForge (BLOQUEANTE)

**2.1** Estratégia de validação do token:
- (a) validação local do JWT com `JWT_SECRET` compartilhado (HS256) — recomendado por agora
- (b) RS256 (AuthForge já suporta) — mais correto, exige mexer no AuthForge
- (c) introspecção via HTTP a cada request
- (d) API Gateway na frente
> 💡 (a) Validação local com `JWT_SECRET` compartilhado via `JwtStrategy` replicada do AuthForge. Zero latência extra, e o código já nasce preparado pra virar RS256 depois (só troca de env), sem precisar mexer no AuthForge agora.

**2.2** Confia cegamente no token válido, ou precisa checar sessão ativa/usuário desativado?
> 💡 Confia no token no MVP (aceitável — token de curta duração, 15min). Checagem de sessão/revogação fica para uma fase futura se virar requisito real de segurança.

**2.3** Reaproveita as roles do token (ADMIN/MANAGER/USER), ou quer permissions novas (`create_card`, etc — exige mexer no seed do AuthForge)?
> 💡 Reaproveita as roles existentes (`ADMIN` para escrita no catálogo, qualquer usuário autenticado para leitura/geração). Evita side-quest de mexer no AuthForge; se crescer, criamos permissions dedicadas depois.

**2.4** Confirma `generated_cards.user_id` como UUID sem FK real (bancos separados)?
> 💡 Sim. UUID vindo do `sub` do JWT, sem foreign key de banco (bancos independentes é o ponto central de microsserviços).

**2.5** Precisa de dados do usuário além do id (nome, email)? Busca sob demanda no AuthForge ou espelho local?
> 💡 Só o `id`. Se precisar de email (p.ex. pra notificação), usa o `email` que já vem no próprio payload do JWT — sem chamada HTTP nem espelho local no MVP.

**2.6** Se precisar chamar o AuthForge servidor-a-servidor, como autentica (repassa token do usuário? API key/M2M nova)?
> 💡 Não deve ser necessário no MVP, já que 2.5 resolve com o payload do token. Se surgir necessidade real, criamos credencial M2M dedicada depois — não fazer isso preventivamente.

---

## 3. Modelagem de dados — catálogo vs. cartas geradas (BLOQUEANTE)

**3.1** Duas tabelas com FK (`cards` catálogo → `generated_cards` instância) ou desnormalizar (copiar dados pra instância)? O que acontece quando um admin edita uma carta que 500 usuários já têm?
> 💡 FK normalizada (`generated_cards.card_id → cards.id`). Editar uma carta do catálogo reflete em todas as instâncias já geradas (comportamento tipo "errata" de TCG físico — é o padrão do gênero e evita duplicar dados). Delete é soft delete (ver 3.8) pra nunca quebrar a FK.

**3.2** Raridade = enum em código (alinhado ao arquivo de config) e Coleção = tabela?
> 💡 Sim. Raridade como enum TypeScript (`COMMON | RARE | EPIC | LEGENDARY`), única fonte de verdade compartilhada com `rarity.config.ts`. Coleção como tabela (`collections`), pois cresce com o tempo.

**3.3** O que é o campo `tipo`?
> 💡 Campo livre (`string`, não enum) no MVP — ex: "criatura", "feitiço", "item" — já que a taxonomia de gameplay ainda não foi definida. Fica fácil de virar enum/tabela depois quando o design do jogo amadurecer.

**3.4** Para que serve o `float` 0–1 (7 casas)? Qualidade/desgaste, power level, desempate, outra coisa?
> 💡 Atributo cosmético/de raridade individual (estilo "float" de skin do CS:GO) — dá identidade única a cada cópia da mesma carta, sem afetar gameplay. Serve de base pra futura precificação/troca sem exigir mudança de schema.

**3.5** Coluna `numeric(8,7)` ou `double precision`? Intervalo `[0,1]` ou `[0,1)`?
> 💡 `numeric(8,7)` (precisão exata, sem surpresa de arredondamento). Intervalo `(0,1)`.

**3.6** PK de `generated_cards`: `int` ou `bigint`?
> 💡 `int` conforme pedido no requisito. Se o volume de pulls crescer muito (long-term), migrar pra `bigint` é trivial — não precisa decidir isso agora.

**3.7** Separar `owner` de `pulled_by` desde já, ou só `user_id` por ora?
> 💡 Separe em Owner e PulledBy para uma melhor escalabilidade e para suportar o TRADE.

**3.8** Soft delete no catálogo?
> 💡 Sim, `deleted_at` (mesmo padrão do AuthForge), pra nunca invalidar a FK de cartas já geradas.

**3.9** Precisa de tabela de histórico de pulls, ou `created_at` já resolve?
> 💡 `generated_cards.created_at` já resolve no MVP — cada linha É um registro histórico do pull.

---

## 4. Configuração de raridades e algoritmo (BLOQUEANTE)

**4.1** Arquivo `rarity.config.ts` tipado no git, ou JSON/YAML editável sem redeploy?
> 💡 `src/config/rarity.config.ts` tipado, versionado no git, validado no boot — exatamente como pedido ("arquivo dedicado"). Editar exige redeploy, o que é aceitável e mais seguro que hot-reload de probabilidades de valor real.

**4.2** Porcentagens globais ou por coleção?
> 💡 Globais no MVP (uma distribuição única: comum 60/rara 25/épica 14/lendária 1%), como no exemplo do requisito. Estrutura do arquivo já preparada para virar mapa por coleção depois sem quebrar a API.

**4.3** Confirma sorteio em dois passos — (1) sorteia raridade pela distribuição, (2) sorteia carta uniformemente dentro da raridade+coleção?
> 💡 Sim. É o único jeito de a config "lendária = 1%" ser literalmente 1% (o protótipo antigo em `dot-api` fazia peso-por-carta, o que distorcia as porcentagens — não repetir esse bug).

**4.4** O que fazer se a raridade sorteada não tem cartas na coleção: re-sortear e renormalizar, cair pra raridade inferior, erro 409, ou validar no boot?
> 💡 Re-sortear excluindo raridades vazias daquela coleção e renormalizar as probabilidades restantes. Mantém o jogo sempre funcional mesmo com coleções incompletas, sem exigir validação manual toda vez que alguém cadastra uma coleção nova.

**4.5** App deve falhar no boot se as porcentagens não somarem 100%?
> 💡 Sim, fail-fast no boot (mesmo padrão do `env.validation.ts` do AuthForge) — erro de config detectado em dev, não em produção.

**4.6** `Math.random()` basta, ou `crypto.randomInt`?
> 💡 `Math.random()` no MVP — não há economia real envolvida ainda. Trocar para `crypto.randomInt` é uma troca de uma linha se isso um dia tiver valor monetário.

**4.7** Duplicatas permitidas (mesma carta base várias vezes)?
> 💡 Sim, é o comportamento padrão de gacha/TCG — cada pull é independente.

**4.8** Rate limit/cooldown de geração, ou ilimitado no MVP?
> 💡 Sem limite dedicado no MVP, além do throttler padrão global (mesmo `@nestjs/throttler` do AuthForge) contra abuso básico. Regras de economia (cooldown, custo) ficam pra quando houver sistema de moeda.

**4.9** Multi-pull (abrir pacote de N de uma vez), com ou sem "pity"?
> 💡 Multi-pull por pacote.

**4.10** Transação por pull individual, ou por pacote inteiro?
> 💡 Pacote inteiro

---

## 5. Endpoints e acesso

**5.1** CRUD do catálogo: GET público, POST/PATCH/DELETE só ADMIN?
> 💡 GET requer apenas autenticação (qualquer usuário logado); POST/PATCH/DELETE exigem role `ADMIN`.

**5.2** Rota de gerar carta (`POST /collections/:id/pulls`?) — `userId` sempre vem do token, nunca do body?
> 💡 `POST /collections/:id/pulls`. `userId` sempre extraído do token (`req.user.sub`), nunca aceito no body — evita gerar carta em nome de outro usuário.

**5.3** Precisa `GET /me/cards` e/ou `GET /users/:id/cards`?
> 💡 `GET /me/cards` (usuário vê as próprias cartas). `GET /users/:id/cards` também, restrito a `ADMIN` (suporte/moderação).

**5.4** Cartas geradas têm PATCH/DELETE, ou são imutáveis?
> 💡 Imutáveis no MVP. "Queimar carta"/revogação fica pra quando houver caso de uso real (inventário, trade).

**5.5** Paginação/filtros nos GETs (coleção, raridade, tipo, nome)?
> 💡 Paginação offset/limit (mesmo estilo do AuthForge) + filtros por `collection`, `rarity` e `type` no catálogo. Sem ordenação avançada no MVP.

**5.6** Formato de resposta: DTO puro (padrão AuthForge), ou envelope tipo o do protótipo antigo?
> 💡 DTO puro + exception filters do Nest, igual ao AuthForge — consistência entre os serviços do ecossistema.

**5.7** CRUD de coleções entra no MVP, ou só seed?
> 💡 Só seed/migration no MVP. Endpoint de gestão de coleções fica pra depois, junto do CRUD de catálogo se crescer a necessidade.

**5.8** Precisa `GET /health` (Postgres + RabbitMQ)?
> 💡 Sim, health check simples verificando conexão com Postgres e RabbitMQ — barato de implementar, útil desde já para o Docker/orquestração.

---

## 6. RabbitMQ — qual o caso de uso real (BLOQUEANTE)

**6.1** DotCard é produtor, consumidor, ou ambos?
- (a) só produtor pro MailForge
- (b) também consumidor de eventos do AuthForge tipo `user.created` (exige implementar publicação dentro do AuthForge, que não existe hoje)
- (c) só subir a infra, sem uso funcional ainda
> 💡 (a) Só produtor pro MailForge. Dá um uso real e concreto ao broker (ver 6.2) sem exigir nenhuma mudança no AuthForge — mantém o escopo deste projeto autocontido.

**6.2** Que eventos o DotCard publicaria (`card.pulled`, `card.legendary.pulled`...)? Alguém consome?
> 💡 Publica direto no contrato do MailForge quando o pull resultar em carta **lendária**: envia `{ type: 'default-notification', to: email(do JWT), data: { title, message } }` pra fila `mail.queue`. É o único evento no MVP — simples, visível, e conecta de fato os 3 serviços conforme pedido no requisito original.

**6.3** Se publicar pro MailForge, usa `noAssert:true` (MailForge é dono da fila)?
> 💡 Sim, `noAssert:true` — o MailForge já é dono da topologia (exchange/queue/DLQ), o DotCard só publica.

**6.4** Um broker ou dois? O broker novo do DotCard é a mesma instância compartilhada com o MailForge (aposentando o do projeto auxiliar `testMq`), ou uma instância isolada?
> 💡 Mesma instância compartilhada. O DotCard-API passa a ser o dono oficial do compose do RabbitMQ do ecossistema; o compose do `testMq` pode ser aposentado (ou mantido só como referência de teste manual, sem subir broker próprio).

**6.5** Convenção de filas próprias (`dotcard.exchange`/`dotcard.<evento>.queue`)?
> 💡 Não necessário no MVP — o DotCard só publica na fila que já existe do MailForge (`mail.queue`), não declara filas/exchanges próprias ainda. Criamos `dotcard.*` no dia em que o DotCard precisar consumir algo.

**6.6** Precisa de outbox pattern (garantir publish só se a transação commitou), ou "best effort" no MVP?
> 💡 Best effort no MVP: se a publicação falhar, loga o erro mas não bloqueia/reverte a geração da carta (o usuário não deve perder a carta por causa de uma falha de notificação). Outbox pattern fica pra quando isso for crítico.

**6.7** Credenciais dev: `guest:guest` serve, ou usuário/vhost dedicados?
> 💡 `guest:guest` em dev (mesmo padrão do `testMq` atual), parametrizado via env para trocar facilmente em produção.

---

## 7. Email — caso de uso real

**7.1** Existe algum gatilho de email no MVP (ex: "carta lendária obtida", "coleção completa"), ou é só deixar a porta aberta?
> 💡 Sim: notificação de "Você obteve uma carta lendária!" ao puxar uma carta de raridade `LEGENDARY`. Notificar quando completar a colecao tambem.

**7.2** Se houver: usa o template genérico `default-notification` já existente, ou cria template novo (exige PR no MailForge)?
> ✅ **DECISÃO ATUALIZADA (2026-08-06):** Usa o template genérico `default-notification` (`name`, `title`, `message`) para os dois casos (carta lendária e coleção completa), variando só o conteúdo de `title`/`message` por chamada. Mantém o MailForge livre de vocabulário específico de "card game", preservando sua genericidade para outros projetos. Não exige nenhuma alteração no submodule do MailForge.

**7.3** Email do destinatário vem direto do JWT (já tem `email` no payload)?
> 💡 Sim, direto do `email` do payload do JWT — zero chamada HTTP extra ao AuthForge.

**7.4** Precisa de opt-in/preferência de notificação por usuário?
> 💡 Não no MVP — sempre notifica em pull lendário. Preferências de notificação ficam pra uma fase futura.

---

## 8. Infraestrutura e Docker

**8.1** Postgres próprio em container — porta do host (AuthForge já usa 5432; DotCard usaria 5433)?
> 💡 Sim, Postgres próprio, porta `5433` no host, database/user `dotcard`.

**8.2** Porta HTTP do DotCard (AuthForge usa 3000 — 3001?)?
> 💡 `3001`.

**8.3** Cada repo mantém seu próprio compose (sobe os 3 separado), ou um compose "raiz" orquestra tudo numa rede compartilhada? Se sim, onde mora esse compose?
> ✅ **DECISÃO ATUALIZADA (2026-08-06):** DotCard-API vira o repositório raiz do backend. AuthForge e MailForge entram como **git submodules** dentro dele (`services/auth-forge`, `services/mail-forge`). Um **único `docker-compose.yml`** na raiz do DotCard-API sobe TODO o ambiente numa mesma rede: DotCard-API + seu Postgres, AuthForge + seu Postgres, MailForge, e o RabbitMQ compartilhado. Os composes internos de cada submodule continuam existindo (para quem quiser rodar aquele serviço isolado), mas o compose raiz é a fonte única de verdade para "subir o backend completo".
>
> `git clone --recurse-submodules` traz os 3 repositórios de uma vez; cada submodule mantém sua própria história e é fixado por commit (como sempre em git submodules — atualizar a versão de um serviço é um `git submodule update --remote` + commit do ponteiro).

**8.4** Rede Docker compartilhada entre os 3 serviços — autorizado editar os composes do AuthForge/MailForge pra isso?
> ✅ Não precisa mais editar os composes internos do AuthForge/MailForge — a rede compartilhada é definida direto no compose raiz do DotCard-API, que já enxerga os 3 serviços via submodule. Os composes internos de cada um seguem intocados/isolados para uso standalone.

**8.5** Mesmo Dockerfile multi-stage (node:22-alpine, usuário não-root) do AuthForge?
> 💡 Sim, mesmo padrão (deps → build → runtime, usuário não-root).

**8.6** Seed do catálogo: tema/conjunto de cartas real em mente, ou dados fictícios pra dev?
> 💡 Dados fictícios de tema genérico fantasia/RPG (ex: "Dragão Ancião", "Curandeiro da Floresta"), ~20–30 cartas distribuídas nas 4 raridades e em 1–2 coleções de exemplo — o suficiente pra testar o algoritmo de sorteio ponta a ponta.

**8.7** `.env.example` + validação de env no boot, como no AuthForge?
> 💡 Sim, mesmo padrão (`.env.example` + `class-validator` no boot).

---

## 9. Observabilidade

**9.1** Logger estruturado (Pino, ou reaproveitar padrão dos outros serviços)?
> 💡 Logger padrão do Nest com formato estruturado (mesmo nível usado no AuthForge/MailForge hoje) — sem introduzir Pino como dependência nova no MVP.

**9.2** Correlation-id entre serviços, agora ou depois?
> 💡 Depois — só vira relevante quando houver mais fluxos assíncronos entre os serviços do que o único evento de email do MVP.

**9.3** Métricas/tracing agora ou depois?
> 💡 Depois.

**9.4** CI (lint+test+build) entra no escopo?
> 💡 Sim — CI básico (lint + test + build) desde o início é barato e evita regressões, mesmo em MVP.

---

## 10. Fora do MVP (confirmar exclusões explícitas)

- Trade entre usuários?
> 💡 Sim, entra no MVP

- Marketplace / economia com moeda?
> 💡 Nao criar agora, mas deixar crair projeto com pretencao de integrar mercado e moeda no futuro

- Decks e mecânica de partida/batalha (isso é só colecionável ou vai ter jogo de fato)?
> 💡 Fora do MVP — assumindo que por ora é só o aspecto colecionável (geração/coleção de cartas), sem motor de partida.

- Inventário com stack/"queimar carta"?
> 💡 Fora do MVP (cada carta gerada já é registrada individualmente; sem stack/queima).

- Achievements de coleção?
> 💡 Fora do MVP.

- Leaderboard?
> 💡 Fora do MVP.

- Imagens das cartas (`image_url`) — entra ou não?
> ✅ **DECISÃO FECHADA (2026-08-06):** Entra. Campo `image_url` (nullable) na tabela `cards`. Armazenamento via **MinIO** (S3-compatible) rodando como mais um serviço no `docker-compose.yml` raiz do DotCard-API, junto com os 2 Postgres e o RabbitMQ. Backend usa `@aws-sdk/client-s3` contra o MinIO em dev; em produção troca só endpoint/credenciais para um S3/R2 real, sem mudar código. Endpoint do MinIO exposto localmente com console web numa porta separada. Upload de imagem entra no CRUD administrativo de cartas (`POST`/`PATCH /cards/:id`), retornando/aceitando a URL do objeto.

- Eventos/coleções sazonais?
> 💡 Fora do MVP.

- Sistema de pity?
> 💡 Fora do MVP (depende de multi-pull, que também está fora — ver 4.9).

- Versionamento `/v1` da API desde já?
> 💡 Sim, prefixo `/v1` desde o início — custo baixíssimo agora, evita breaking change depois.
