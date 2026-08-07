# Decisões pendentes — DotCard-API (rodada 2)

> Estas são as decisões que surgiram da avaliação do escopo, principalmente por causa das mudanças que você fez no arquivo anterior (trade dentro do MVP, multi-pull, owner/pulled_by).
> Cada item já vem com a resposta que recomendo (💡). **Valide deixando como está, ou apague e escreva a sua.**
>
> **ATUALIZADO EM 2026-08-07** com suas decisões: trade **entra** no MVP, pulls **limitados por moeda do jogo**, `name` **vem do token**. Itens alterados estão marcados com ✅ **DECIDIDO**. A moeda entrando no escopo abriu um bloco novo de perguntas — ver **seção E**, que precisa da sua resposta.

---

## A. Escopo do trade (decide o resto)

**A.1** Trade entra no MVP ou fica para a fase 2?

Contexto: trade exige tabela de propostas, fluxo aceite/recusa, transferência atômica de posse, validação de que ambos os lados ainda possuem as cartas, e proteção contra corrida (duas propostas aceitas com a mesma carta = double-spend).

> ✅ **DECIDIDO: (B) Trade DENTRO do MVP.**
>
> Consequências assumidas: cartas passam a ser mutáveis no campo `owner` (A.2), entra tabela de propostas de troca com fluxo de aceite/recusa, transferência precisa ser transacional com lock nas linhas envolvidas, e `bigint` na PK deixa de ser "recomendado" e vira obrigatório (C.1). A separação `owner`/`pulled_by` que você já tinha decidido no arquivo anterior agora tem uso real desde o dia 1.

**A.2** Cartas geradas são imutáveis?

> ✅ **DECIDIDO: mutáveis apenas no campo `owner`.** Todo o resto da carta gerada (carta base, float, `pulled_by`, `created_at`) permanece imutável — o float é o que dá identidade única à cópia e nunca muda de valor ao trocar de dono. Sem PATCH/DELETE público sobre cartas geradas; a única mutação possível é a transferência de posse via fluxo de trade.

**A.3** Escassez: pulls continuam ilimitados?

> ✅ **DECIDIDO: pulls limitados por moeda do jogo.** A moeda entra no escopo do MVP como mecanismo de escassez (não como marketplace — ver E.2). Cada pacote tem um custo configurado no arquivo dedicado, o saldo é debitado na mesma transação da geração das cartas, e pull sem saldo suficiente retorna erro (`402`/`409`).
>
> Isso **altera a decisão do arquivo anterior** (bloco 10), onde moeda estava marcada como "não criar agora". Agora existe uma carteira (`user_balances`) no MVP. Marketplace/compra de moeda com dinheiro real continua fora.

---

## E. Economia e moeda (bloco NOVO — precisa da sua resposta)

A entrada da moeda no escopo abre decisões que ainda não foram tomadas. **E.1 é bloqueante**: sem ela o jogo trava assim que o saldo inicial acabar.

**E.1** Como o usuário adquire moeda?

Sem uma fonte de renda, o jogo fica injogável depois dos primeiros pacotes. Opções:

- (a) **Saldo inicial + recarga diária** — usuário ganha X ao entrar pela primeira vez e recebe Y por dia.
- (b) **Só saldo inicial** — acabou, acabou (inviável na prática).
- (c) **Vender/queimar cartas de volta ao sistema** — cria o ciclo completo (moeda → carta → moeda). Porém "queimar carta" estava marcado como fora do MVP no arquivo anterior.
- (d) **Admin concede manualmente** — só serve para testes.

> 💡 **(a) Saldo inicial + recarga diária.** É o mínimo que mantém o jogo jogável sem expandir escopo. Implementação sem scheduler/cron: guardar `last_allowance_at` na carteira e, a cada requisição de pull, verificar preguiçosamente se virou o dia e completar o saldo até o teto diário. Evita depender de job agendado no MVP.
>
> Recomendo **deixar (c) fora por enquanto** — queimar carta interage diretamente com trade (queimar uma carta que está prometida numa proposta aberta) e merece ser desenhada com calma.

**E.2** O trade envolve moeda ou é só carta-por-carta?

Contexto: se uma proposta pode incluir moeda, isso é essencialmente um marketplace P2P — o que você marcou como fora do MVP no arquivo anterior.

> ✅ **Só carta-por-carta, e estritamente 1 carta por 1 carta** (ver E.7). Mantém a coerência com "marketplace fora do escopo" e evita precificação/especulação. Moeda dentro da proposta é a evolução natural quando o marketplace entrar.

---

**E.7** Fluxo da negociação ✅ **DECIDIDO — negociação em duas fases, 1:1**

A troca é **uma carta por uma carta**, negociada em duas etapas. Quem propõe **não escolhe** o que quer receber; quem recebe é que oferece a contrapartida.

```
User1 cria a proposta e escolhe SUA carta
        │
        ▼
  AWAITING_COUNTERPART ─────────────► User2 recusa ──► CANCELLED
        │
        │ User2 escolhe a carta dele
        ▼
  AWAITING_CONFIRMATION ────────────► User1 cancela ─► CANCELLED
        │
        │ User1 confirma (decisão final)
        ▼
     ACCEPTED  →  troca executada
```

Regras por etapa:

| Etapa | Quem age | Ações possíveis |
|---|---|---|
| Criação | User1 | escolhe **apenas a própria carta** |
| Contrapartida | User2 | escolher uma carta sua **ou** recusar |
| Confirmação | User1 | aceitar (executa a troca) **ou** cancelar |

**Impacto no schema — `trade_offer_items` deixa de existir.** Com 1:1, não há mais lista de itens: as duas cartas cabem como colunas na própria `trade_offers`.

```
trade_offers
  id                  bigint PK
  from_user           uuid          -- User1
  to_user             uuid          -- User2
  offered_card_id     bigint  FK → generated_cards   NOT NULL  (escolhida por User1 na criação)
  requested_card_id   bigint  FK → generated_cards   NULL      (escolhida por User2 na contrapartida)
  status              trade_status
  cancelled_by        uuid          NULL             (quem interrompeu, se aplicável)
  expires_at          timestamptz
  created_at / countered_at / resolved_at
```

`requested_card_id` nascer `NULL` é o que representa a fase 1 — o campo só é preenchido quando User2 responde.

**Enum `trade_status` revisado:** `AWAITING_COUNTERPART`, `AWAITING_CONFIRMATION`, `ACCEPTED`, `CANCELLED`, `EXPIRED`.

**Validação de posse por etapa:**
- criação → `offered_card.owner = from_user`
- contrapartida → `requested_card.owner = to_user`
- confirmação → revalida **as duas** sob `SELECT ... FOR UPDATE`

**Lacunas que esta decisão resolveu de vez:** teto de itens por proposta (sempre 1), unique em `(offer, card)` (não há mais tabela de itens), proposta com lado vazio/presente (impossível — sempre 1×1).

**E.7.1** A proposta é dirigida a um usuário específico ou é aberta?

> ✅ **DECIDIDO: dirigida.** User1 escolhe explicitamente para quem envia a solicitação. `to_user` é preenchido na criação, e a trava de E.6.1 alcança os dois desde o primeiro instante. Modalidade aberta (mural) fica para a fase 2, junto do marketplace.

**E.7.3** Quem pode cancelar, e quando? ✅ **DECIDIDO**

> **Ambos os usuários podem cancelar a qualquer momento**, em qualquer estado não-terminal (`AWAITING_COUNTERPART` ou `AWAITING_CONFIRMATION`). Cancelamento é unilateral — não depende do consentimento do outro lado. O campo `cancelled_by` registra quem interrompeu.
>
> Isso substitui a distinção entre "recusar" (User2) e "cancelar" (User1): é a **mesma ação**, disponível para os dois, o tempo todo. Simplifica a API (um endpoint só) e a máquina de estados.
>
> ⚠️ **Consequência importante:** essa decisão muda o papel da expiração — ver E.7.2 revisado.

**E.7.2** O prazo de expiração é global ou por etapa? ✅ **REVISADO após E.7.3**

> **Prazo único e global, contado da criação. Sem renovação por etapa.**
>
> Minha recomendação anterior (renovar o prazo a cada fase) resolvia um problema que **deixou de existir** quando você definiu que ambos podem cancelar a qualquer momento. A explicação completa está logo abaixo, mas em resumo: a expiração deixou de ser a válvula de escape da trava e virou apenas higiene de dados, então não vale a complexidade de recalcular prazo por fase — que ainda por cima dobrava o tempo máximo de trava (prazo na fase 1 + prazo na fase 2).
>
> Sugiro prazo padrão **generoso (7 dias)**, já que ninguém fica realmente preso por ele. Expiração preguiçosa: ao consultar as próprias trocas ou ao tentar criar uma nova, uma proposta vencida é marcada `EXPIRED` e as travas são liberadas.

---

### Por que a expiração era um problema — e por que deixou de ser

**Antes da decisão E.7.3**, a expiração carregava um peso que não era dela. Como a troca trava os dois usuários (E.6.1) e cada fase dependia de uma pessoa específica agir, existiam dois problemas encadeados:

1. **Divisão injusta do prazo.** Com um `expires_at` único contado da criação, as duas fases dividem o mesmo orçamento de tempo. Se User2 respondesse com 47 das 48 horas já gastas, sobrava uma hora para User1 decidir. Quem agia tarde roubava o tempo do outro.

2. **A correção saía cara.** Renovar o prazo a cada transição resolvia a injustiça, mas dobrava o pior caso: 2 dias esperando a contrapartida + 2 dias esperando a confirmação = **4 dias com os dois usuários travados** por uma única negociação.

O nó real era que a expiração funcionava como **única saída automática da trava**. Se User1 propunha e User2 sumia, User1 ficava impedido de jogar até o prazo vencer — sem nada que pudesse fazer a respeito.

**A decisão E.7.3 desfaz esse nó.** Se qualquer um dos dois pode cancelar unilateralmente a qualquer momento, então:

- User1 propôs e User2 sumiu? User1 cancela e está livre imediatamente.
- User2 foi alvo de uma proposta que não interessa? Cancela e está livre.
- Os dois querem sair? Qualquer um dos dois resolve.

**Nenhum usuário ativo fica preso.** A trava só permanece enquanto ambos os lados estiverem inertes — e nesse caso não há ninguém sendo prejudicado.

Sobra para a expiração apenas o papel de faxina: impedir acúmulo indefinido de propostas zumbis e garantir que uma trava esquecida não sobreviva para sempre no banco. Para isso, prazo único e generoso basta.

**E.3** Onde fica a configuração de custo dos pacotes?

> 💡 No **mesmo arquivo dedicado de configuração** do jogo (ao lado das porcentagens de raridade), num bloco separado: custo do pacote de 1, de 5 e de 10, mais saldo inicial e recarga diária. Mantém "todo comportamento configurável centralizado", como o AuthForge já faz, e permite balancear a economia sem caçar constantes pelo código.

**E.4** Como proteger o saldo contra corrida (double-spend de moeda)?

Contexto: duas requisições de pull simultâneas do mesmo usuário podem ler o mesmo saldo e ambas passarem na validação, gastando mais do que o usuário tem.

> 💡 **`SELECT ... FOR UPDATE`** na linha da carteira dentro da transação do pull (débito + geração das cartas no mesmo commit). Mesmo padrão vale para a transferência de posse no trade. É a proteção mais simples e correta em Postgres, sem precisar de lock distribuído.

**E.5** Propostas de troca expiram?

> 💡 **Sim, com prazo configurável.** Expiração preguiçosa (marcar como expirada ao consultar/aceitar/tentar criar nova) evita precisar de cron no MVP.
>
> ⚠️ **Prazo padrão revisado de 7 para 2 dias**, por causa da decisão E.6.1. Antes a expiração só limpava a listagem; agora ela é a **única** válvula de escape de um usuário travado por uma proposta que o outro lado ignorou. Ficar impedido de jogar por uma semana inteira nesse caso é punitivo demais. Se você preferir outro prazo, este é o número a ajustar.

**E.6** Uma carta pode estar em várias propostas abertas ao mesmo tempo?

> ✅ **DECIDIDO: não — uma troca por vez, por usuário.** Enquanto um usuário tem uma proposta ativa, ele fica **travado para novas trocas** até que ela seja aceita, recusada, cancelada ou expirada.
>
> **Consequência importante e positiva:** como no MVP não existe nenhuma outra forma de uma carta trocar de dono (sem marketplace, sem queimar carta), travar o usuário significa que **a posse das cartas não pode mudar enquanto a proposta está aberta**. Isso elimina de vez o problema de propostas obsoletas que eu havia levantado — não existe mais o cenário "Carlos aceita e descobre que a carta já é de outro". A revalidação de posse no aceite continua no código como rede de segurança, mas passa a ser uma formalidade que nunca deve falhar.
>
> Também **cancela a pergunta sobre limpeza de propostas obsoletas** (invalidação preguiçosa vs. ativa) — ela deixa de existir.

**E.6.1** A trava vale para os dois participantes ou só para quem criou a proposta?

> ✅ **DECIDIDO: trava os DOIS participantes** (`from_user` e `to_user`). Ambos ficam congelados para novas trocas até a proposta ser resolvida.
>
> É o que faz a invariante de estabilidade de posse funcionar de verdade — com os dois travados e sem nenhum outro mecanismo de transferência no MVP, nenhuma carta envolvida pode mudar de dono enquanto a proposta estiver aberta.
>
> Sobre griefing (alguém mandar proposta só para travar a vítima): **a regra é auto-limitante**. O atacante também fica preso pela própria proposta, então consegue travar **uma vítima por vez**, e basta ela recusar — uma chamada de API — para ambos serem liberados.
>
> A expiração (E.5) é a válvula de escape para quando o destinatário simplesmente some.

**E.6.2** Como a trava é garantida no banco?

> 💡 Tabela dedicada **`active_trade_locks`** (`user_id` UUID **PK**, `trade_offer_id` FK, `locked_at`). Ao criar a proposta, insere **duas linhas** (uma por participante) dentro da mesma transação; a PK em `user_id` faz o banco rejeitar automaticamente qualquer tentativa de segunda proposta simultânea, sem depender de checagem em código (que teria corrida). Ao resolver a proposta (aceite/recusa/cancelamento/expiração), apaga as duas linhas.
>
> Índices parciais (`UNIQUE ... WHERE status = 'PENDING'`) em `from_user` e `to_user` não bastam: não impedem o mesmo usuário de ser remetente numa proposta e destinatário em outra.
>
> **Expiração preguiçosa:** quando alguém tenta criar uma proposta e esbarra na trava, o sistema verifica se a proposta associada já expirou — se sim, resolve ela como `EXPIRED`, libera as travas e segue com a criação. Assim não é preciso cron no MVP.

---

## B. Gaps concretos (precisam de solução independente de A.1)

**B.1** De onde vem o `name` para o email?

Contexto verificado no código: o `DefaultNotificationDataDto` do MailForge exige `name` como `@IsNotEmpty()`, e o template renderiza `Olá, {{name}}`. Mas o `AccessTokenPayload` do AuthForge tem apenas `sub`, `email`, `roles`, `permissions` — **não tem `name`**. A decisão 2.5 do arquivo anterior ("só id + email do token, sem chamada HTTP") é incompatível com enviar email.

- (a) Usar o próprio email como `name` — zero custo, mas o email fica "Olá, fulano@gmail.com".
- (b) Buscar o usuário no AuthForge via HTTP — reabre a questão de autenticação M2M (2.6), que decidimos não fazer.
- (c) Adicionar `name` ao payload do JWT no AuthForge — mudança de ~3 linhas, não fere a genericidade dele (nome de usuário é campo universal, não vocabulário de card game).

> ✅ **DECIDIDO: (c) `name` vem do token.** Adicionar `name` ao `AccessTokenPayload` do AuthForge.
>
> **Verifiquei no código e é ainda mais barato do que eu estimei:** a entidade `users` do AuthForge **já possui** a coluna `name` (`@Column({ type: 'varchar', length: 255 }) name!: string`). O dado já existe e já é carregado — só não está sendo incluído no token. A mudança é: acrescentar o campo em `AccessTokenPayload` / `AuthenticatedUser` (`src/common/interfaces/jwt-payload.interface.ts`) e preencher no ponto onde o token é assinado (`src/modules/auth/services/auth.service.ts`). **Zero migration, zero chamada HTTP, zero M2M.**
>
> Continua genérico: nome de usuário serve a qualquer consumidor do AuthForge, não é vocabulário de card game. Como o AuthForge é submodule daqui, lembrar de commitar **e dar push no repositório dele** antes de atualizar o ponteiro no repo pai.

**B.2** Idempotência da notificação de "coleção completa".

Contexto: com duplicatas permitidas e catálogo mutável, "completou a coleção" é um estado que oscila. Se um admin adicionar uma carta nova, todo mundo fica incompleto retroativamente e recebe email de novo ao recompletar.

> 💡 Criar tabela **`collection_completions`** (`user_id`, `collection_id`, `completed_at`, unique em user+collection). A notificação só dispara na primeira vez que o par user+coleção aparece. Se o admin adicionar cartas depois, o usuário **não** é re-notificado (o registro já existe) — evita spam e mantém a semântica de "conquista", que é o que o usuário espera.

**B.3** O que `image_url` guarda no banco?

Contexto: se guardar a URL completa (`http://localhost:9000/cards/abc.png`), migrar de MinIO para S3/R2 exige UPDATE em toda a tabela, e a URL fica errada em qualquer ambiente diferente do de dev.

> 💡 Guardar **apenas a chave do objeto** (ex: `cards/abc.png`), e montar a URL completa na serialização do DTO a partir de env (`STORAGE_PUBLIC_URL`). Renomear o campo para `image_key` deixa a intenção explícita. É o que faz o "trocar só endpoint e credenciais" ser verdade de fato.

**B.4** Bucket do MinIO: público ou privado com presigned URL?

> 💡 **Público para leitura** no MVP. Imagens de carta não são dado sensível, e presigned URLs (que expiram) complicam cache no frontend sem benefício real aqui. Escrita continua restrita (só o backend, via credencial).

---

## C. Ajustes de robustez

**C.1** PK de `generated_cards`: manter `int` ou mudar para `bigint`?

Contexto: eu havia dito que migrar `int` → `bigint` é trivial. Com trade no MVP isso deixa de ser verdade (há FK da tabela de propostas apontando para cá, e a migração passa a exigir reescrita da tabela + atualização das FKs).

> ✅ **`bigint` — agora obrigatório, não mais apenas recomendado.** Com trade dentro do MVP (A.1 = B), existirão FKs de `trade_offer_items` para `generated_cards`; migrar o tipo da PK depois exigiria reescrita da tabela e atualização das FKs, com downtime. `bigint` custa 4 bytes a mais por linha e elimina o risco. O requisito original pedia "id numérico int" — `bigint` continua sendo um inteiro numérico, então não viola o pedido.

**C.2** Aleatoriedade: `Math.random()` ou `crypto.randomInt`?

> ✅ **`crypto.randomInt` — agora com justificativa reforçada.** Com trade E moeda no MVP, existe economia real: cartas têm valor de troca e são obtidas gastando um recurso limitado. `Math.random()` não é criptograficamente seguro e seria um ponto legítimo de questionamento. O custo em linhas de código é idêntico.

**C.3** Tamanho do pacote (multi-pull) e teto de quantidade.

Contexto: 4.9 diz "multi-pull por pacote", mas não define quantas cartas tem um pacote, se varia por coleção, nem qual o máximo aceito. Sem teto, alguém manda `quantity: 1000000` e derruba a API.

> 💡 Tamanhos de pacote **fixos e configurados** no arquivo dedicado (junto do `rarity.config.ts` ou num `pack.config.ts` irmão): pacote de **1, 5 e 10** cartas. O endpoint aceita só esses valores (validado por enum no DTO), não um `quantity` livre — resolve o teto e o abuso de uma vez.
>
> **Reforçado pela decisão A.3:** com a moeda no escopo, cada tamanho de pacote agora tem um custo associado (ver E.3), e o desconto por volume ("pacote de 10 custa menos que 10 pacotes de 1") deixa de ser hipótese futura e já pode entrar na configuração inicial.

**C.4** Campo `tipo` como string livre — normalizar?

Contexto: 5.5 prevê filtro por `type`, mas com string livre um typo no cadastro (`"criatura"` vs `"Criatura"`) cria tipos fantasma que quebram o filtro silenciosamente.

> 💡Inicialmente manter o enum como, Creatures, Lands, Sorceries and artifacts, no futuro, podem haver mais.

**C.5** Intervalo do float `(0,1)` exclusivo nos dois extremos.

Contexto: você mudou de `[0,1)` para `(0,1)`. Detalhe de implementação: `Math.random()`/`crypto` produzem valores que, arredondados para 7 casas, podem virar exatamente `0.0000000` — violando a restrição.

> 💡 Manter `(0,1)` conforme você pediu, e garantir na geração: sortear e, se o valor arredondado der `0`, usar o menor valor representável (`0.0000001`). Adicionar **CHECK constraint** no banco (`float > 0 AND float < 1`) para a regra não depender só do código.

**C.6** Revogação de token com trade ativo.

Contexto: com A.1 = B (trade no MVP), um token roubado/pós-logout válido por 15min agora permite **transferir patrimônio** de outro usuário e **gastar a moeda dele** — não só gerar cartas.

> 💡 **Manter a decisão 2.2 (confia no token, sem checar sessão) também nas operações de leitura e pull**, mas **exigir checagem de sessão ativa nas operações sensíveis**: aceitar proposta de troca e criar proposta de troca. Custo: uma consulta ao AuthForge (ou à tabela `sessions`) só nesses dois endpoints, não em todo request.
>
> ⚠️ **Porém isso reabre a questão 2.6 do arquivo anterior** (autenticação M2M), já que o DotCard não tem acesso ao banco do AuthForge. Alternativa mais barata que evita M2M: reduzir o TTL do access token e aceitar o risco residual de 15min. **Esta é a decisão que eu gostaria que você confirmasse** — se preferir simplicidade, respondo "manter 2.2 como está em tudo" e seguimos.

---

## D. Higiene do projeto (baixo custo, alto retorno)

**D.1** Teste explícito de soft delete no sorteio.

> 💡 Sim. É o erro clássico: esquecer `deleted_at IS NULL` no algoritmo de pull faz cartas deletadas continuarem saindo. Um teste unitário dedicado a isso paga o custo na primeira vez que alguém mexer na query.

**D.2** Documentar o fluxo de git submodules no README.

> 💡 Sim. Os três problemas recorrentes: detached HEAD, esquecer `--recurse-submodules` no clone, e — o mais comum — commitar no submodule e esquecer de dar push nele **antes** de commitar o ponteiro no repo pai (o que quebra o clone de qualquer outra pessoa). Uma seção curta no README evita todos.

**D.3** Comentar a origem das definições no compose raiz.

> 💡 Sim. Como decidimos não usar `include`, o compose raiz duplica a definição dos containers de AuthForge/MailForge. Se esses repos mudarem env vars ou Dockerfile, o compose raiz desatualiza silenciosamente. Um comentário por bloco apontando o arquivo de origem reduz bastante o risco.

---

## F. Amizades (bloco NOVO) ✅ **DECIDIDO: trocas só entre amigos**

Trocas passam a exigir vínculo de amizade aceito entre os dois usuários. O mecanismo é convite + aceite, com convite feito por **chave pública de usuário**.

**F.1** Usar o UUID do usuário como chave de convite é problemático?

Resposta curta: **não é um risco de segurança, mas é ruim por outros três motivos.**

Sobre segurança: os UUIDs do AuthForge são gerados por `@PrimaryGeneratedColumn('uuid')`, ou seja, **v4 aleatórios** — não são sequenciais nem adivinháveis, então não existe risco de alguém enumerar a base de usuários. O medo mais óbvio não se aplica aqui.

Os problemas reais são outros:

1. **Usabilidade.** `f47ac10b-58cc-4372-a567-0e02b2c3d479` tem 36 caracteres. Ninguém digita, dita por voz ou memoriza isso. Códigos de amizade existem justamente para serem curtos.
2. **Não é rotacionável.** O UUID é a PK usada em todo o sistema (`sub` do JWT, `owner` das cartas, participantes das trocas). Se virar código público, ele aparece em prints e mensagens e **nunca pode ser trocado**. Um código próprio pode ser regenerado quando o usuário quiser — que é a defesa natural contra spam de convites.
3. **Acoplamento entre serviços.** O UUID pertence ao AuthForge. Transformá-lo em elemento de UX pública do DotCard significa expor o identificador interno de outro serviço; qualquer mudança futura no esquema de identidade quebraria os códigos já compartilhados.

> ✅ **DECIDIDO: chave própria e curta, gerada pelo DotCard.** Formato sugerido: **8 caracteres alfanuméricos maiúsculos** sem caracteres ambíguos (sem `O`/`0`, `I`/`1`), ex.: `K7X4M2QP`. Gerada com `crypto`, com `UNIQUE` no banco e retry em colisão. Rotacionável por endpoint dedicado. O UUID continua sendo a identidade interna — nunca aparece em UX.

**F.2** Onde a chave fica armazenada?

> 💡 Numa tabela **`players`** (visão local do usuário dentro do DotCard), **absorvendo a `user_balances`** que já havíamos previsto — as duas são 1:1 com o usuário e separá-las só gera join sem ganho.
>
> ```
> players
>   user_id            uuid   PK          -- vem do AuthForge, sem FK
>   friend_code        varchar(8) UNIQUE  -- chave pública de convite
>   display_name       varchar(255)       -- cache do `name` do JWT (ver F.5)
>   balance            bigint
>   last_allowance_at  timestamptz
>   created_at / updated_at
> ```
>
> A linha é criada preguiçosamente no primeiro acesso do usuário ao DotCard (upsert a partir do JWT), junto com o saldo inicial de E.1.

**F.3** Modelagem da amizade.

> 💡 Uma tabela só, com **par canônico ordenado**:
>
> ```
> friendships
>   user_a        uuid          -- LEAST(uuid1, uuid2)
>   user_b        uuid          -- GREATEST(uuid1, uuid2)
>   requested_by  uuid          -- quem enviou o convite
>   status        enum PENDING | ACCEPTED
>   created_at / responded_at
>   PRIMARY KEY (user_a, user_b)
> ```
>
> Ordenar o par antes de gravar resolve três coisas de uma vez, **sem código de verificação**:
> - a PK impede duplicidade da relação;
> - impede convites cruzados virarem duas linhas (Ana→Bruno e Bruno→Ana);
> - a consulta "somos amigos?" é uma única leitura por PK.
>
> `requested_by` é necessário porque a ordenação canônica descarta a informação de quem convidou — e só o **destinatário** pode aceitar.
>
> Efeito colateral elegante: se Bruno convidar Ana enquanto o convite dela está `PENDING`, o insert colide com a PK. Em vez de erro, o caso pode ser tratado como **aceite automático** — os dois se convidaram mutuamente.

**F.4** O que acontece ao recusar ou desfazer amizade?

> 💡 **Apagar a linha** nos dois casos. Recusar não deixa registro (permite novo convite no futuro); desfazer amizade volta ao estado inicial. Simples e sem estado morto.
>
> O risco é spam de convites repetidos após recusa. A defesa já existe: a rotação do `friend_code` (F.1). Se virar problema real, um status `BLOCKED` resolve — mas não no MVP.

**F.5** Como listar amigos, se o DotCard não conhece os nomes dos outros usuários?

Gap concreto: o JWT traz o `name` **apenas do usuário autenticado**. Para exibir "seus amigos: Ana, Bruno", o DotCard precisaria dos nomes de terceiros — que ele não tem, e buscar no AuthForge reabriria a questão M2M (2.6).

> 💡 **Cache local do nome.** A cada requisição autenticada, o `display_name` do `players` é atualizado a partir do `name` do próprio JWT (upsert barato). Como todo usuário que interage com o sistema grava o próprio nome, listar amigos vira uma leitura local — sem HTTP, sem M2M.
>
> O nome pode ficar levemente desatualizado se a pessoa trocar de nome no AuthForge e não voltar ao DotCard. É aceitável: corrige sozinho no próximo acesso dela.

**F.6** Onde a regra "só troca entre amigos" é aplicada?

> 💡 **Na criação da proposta** (E.7): valida que existe `friendships` com `status = ACCEPTED` para o par ordenado. Se não houver, `403`.
>
> Não revalidar nas etapas seguintes: se a amizade for desfeita no meio de uma negociação, a troca em andamento segue válida — e, como ambos podem cancelar a qualquer momento (E.7.3), quem não quiser mais trocar resolve sozinho. Revalidar em cada etapa só adicionaria consulta sem ganho prático.

**F.7** Convite de amizade dispara email?

> 💡 **Não no MVP.** Os gatilhos de email seguem sendo apenas carta lendária e coleção completa (7.1). Notificar convite exigiria o email de terceiros — que, diferente do nome, é dado sensível e eu evitaria cachear localmente sem necessidade.

---

## Resumo do impacto das decisões tomadas

Com **A.1 = (B) trade no MVP** + **A.3 = pulls por moeda** + **B.1 = name no token** + **F (amizades)**, o MVP passou a incluir:

| Área | O que entrou |
|---|---|
| Modelagem | `owner` mutável; tabelas `trade_offers`, `players`, `friendships` |
| Economia | Moeda do jogo, custo por pacote, saldo inicial + recarga diária, débito transacional |
| Social | Amizade por código curto rotacionável, convite/aceite, troca restrita a amigos |
| Concorrência | `SELECT ... FOR UPDATE` no saldo e na transferência de posse; trava de troca por usuário |
| Endpoints | Trocas (criar/contrapropor/confirmar/cancelar); saldo; amizades (convidar/aceitar/remover/listar); rotacionar código |
| AuthForge | `name` adicionado ao payload do JWT (única mudança no submodule) |
| Robustez | `bigint` na PK (obrigatório), `crypto.randomInt` |

**Estimativa:** o MVP ficou aproximadamente **2x maior** do que na versão anterior do escopo. Trade + economia + social somados têm porte comparável a todo o resto (catálogo + geração + coleção + notificações). Isso é uma escolha legítima — só vale ter clareza de que a fase 3 (execução) será proporcionalmente mais longa.

## Ainda em aberto

- **E.1** — como o usuário adquire moeda (**bloqueante**: sem isso o jogo trava quando o saldo acabar)
- **E.3, E.4** — configuração de custo e proteção do saldo (recomendações prontas, falta validar)
- **C.6** — se as operações de troca exigem checagem de sessão ativa (implica M2M) ou se aceitamos o risco de 15min
- **Checagem de coleção completa após troca** — hoje só está prevista após pull; quem completar recebendo cartas numa troca não seria notificado
