# Projeto: Quórum e Participação via Google Meet API

Documento de planejamento. Escrito em 03/08/2026.

Substitui o registro manual de quórum (e a antiga extensão de Chrome, removida em 28/04/2026) por
captura automática pela API oficial do Google Meet, sem bot, sem nada rodando no navegador de ninguém.

---

## 1. O problema

Hoje o quórum da Formação é registrado à mão em `/formacao/admin/quorum`. Isso significa três coisas:

1. **O dado depende de alguém lembrar.** Encontro não registrado é encontro que não existiu para o sistema.
2. **O dado é grosso.** Sabemos "compareceram 12", não sabemos quem, nem por quanto tempo, nem quem chegou
   no fim só para marcar presença.
3. **Não dá para responder as perguntas que importam.** Quem está sumindo aos poucos? Aquele grupo está
   esvaziando ou sempre foi pequeno? O condutor segura as pessoas ao longo dos meses? Naquele grupo as
   pessoas falam, ou só o condutor fala?

A Formação já tem as telas (`/admin/estatisticas`, `/admin/condutores`, `/admin/atividades`, Top Ranking).
O que falta é matéria-prima confiável para alimentá-las.

## 2. O que o sistema faz

Ao agendar um encontro no painel, a plataforma cria o link do Meet ela mesma, via API, já configurado.
Três chaves no formulário de agendamento:

* gravar (usa a gravação nativa do Meet, salva no Drive)
* transcrever (usa a transcrição nativa, salva em Docs)
* gerar notas automáticas

Depois que o encontro termina, um processo lê da API quem entrou, quando entrou, quando saiu, quantas vezes
entrou, e (nos encontros com transcrição ligada) quanto tempo cada pessoa falou. Grava tudo no Supabase e
alimenta as telas que já existem, mais as novas.

Ninguém precisa clicar em gravar. Ninguém precisa anotar presença. Ninguém entra na sala como robô.

## 3. As perguntas que o sistema passa a responder

### 3.1 Camada de presença (funciona mesmo sem gravar nada)

| Indicador | Como se calcula | Para que serve |
|---|---|---|
| Quórum absoluto | contagem de participantes do encontro | comparação bruta entre encontros |
| Quórum relativo | presentes ÷ inscritos do grupo | comparar grupo de 8 com grupo de 30 sem injustiça |
| Minutos por pessoa | soma das sessões daquele participante | separar quem ficou de quem passou |
| Permanência % | minutos da pessoa ÷ duração do encontro | detectar presença simbólica |
| Pontualidade | entrada da pessoa menos início da conferência | ver se o atraso é da pessoa ou do grupo inteiro |
| Saída antecipada | fim da pessoa comparado ao fim do encontro | quem some na última meia hora |
| Fragmentação | número de sessões da mesma pessoa | conexão instável ou entra e sai |
| Duração real | fim menos início da conferência | encontro previsto de 90 min que dura 40 |

### 3.2 Camada de fala (exige transcrição ligada naquele encontro)

| Indicador | Como se calcula | Para que serve |
|---|---|---|
| Minutos falados | soma de (fim menos início) das falas da pessoa | quem participa de fato, não só assiste |
| Turnos de fala | número de entradas de transcrição da pessoa | distinguir diálogo de monólogo |
| Vozes ativas | % de presentes que falaram ao menos uma vez | o indicador mais honesto de um grupo vivo |
| Concentração da fala | % do tempo total falado que é do condutor | quem conduz e quem palestra |
| Silêncio individual | encontros seguidos presente e sem falar | sinal precoce de desligamento |

**Decisão de projeto:** guardar apenas as durações, não o texto das falas. Os encontros de formação podem
tocar em material clínico, e transcrição de conteúdo clínico é dado sensível. Extraímos a métrica e
descartamos o conteúdo. O arquivo original permanece no Drive do organizador, sob o controle de sempre.

### 3.3 Camada temporal (é aqui que mora o valor real)

* **Curva de quórum por grupo.** Semana a semana. Diz se o grupo está segurando, crescendo ou esvaziando.
* **Retenção por coorte.** Dos que estavam no encontro 1, quantos ainda aparecem no 4, no 8, no 12.
  Esse é o número que mede condução de grupo, e não o quórum médio.
* **Meia-vida do grupo.** Em quantos encontros o quórum cai à metade. Comparável entre grupos e ao longo do tempo.
* **Tendência individual.** Presença nos últimos 4 encontros contra os 4 anteriores. Pega evasão em curso,
  antes de virar desistência.
* **Núcleo e periferia.** Quantos vêm sempre, quantos vêm às vezes, quantos vieram uma vez só.
* **Quórum por horário e por dia.** Cruzado com todos os grupos, diz se o problema é o condutor ou se é a
  terça às 21h. Insumo direto para a montagem dos slots do semestre seguinte.

### 3.4 Sobre avaliar condutor (a parte delicada)

Quórum bruto **não** mede condução. Um grupo pequeno pode ser de um horário ruim; um grupo grande pode ser
de um horário nobre. Comparar condutores por quórum absoluto produz injustiça e desconfiança, e desconfiança
mata a adesão ao sistema inteiro.

O que efetivamente informa sobre condução:

1. **Retenção relativa**: a curva daquele grupo comparada com a média dos grupos do mesmo horário.
2. **Vozes ativas**: proporção de pessoas que falam. Um grupo em que 80% fala é diferente de um em que 25% fala.
3. **Concentração da fala do condutor**: sinal de aula expositiva onde deveria haver grupo.
4. **Constância**: encontros que aconteceram ÷ encontros agendados, e pontualidade do próprio condutor.

Nenhum desses números decide nada sozinho. Eles servem para saber **onde olhar** e **o que perguntar**,
que é diferente de servir para ranquear pessoa.

### 3.5 Alertas operacionais

* aluno com duas ausências seguidas
* aluno presente há três encontros sem falar nenhuma vez
* grupo com queda sustentada de quórum em três encontros consecutivos
* encontro agendado sem nenhum registro de conferência (não aconteceu, e ninguém avisou)
* condutor ausente do próprio encontro
* encontro que durou menos da metade do previsto

## 4. Arquitetura

Sem bot, sem extensão, sem nada no navegador. Servidor conversando com o Google.

```
Painel Allos (agendamento)
   │  cria o space já configurado
   ▼
Google Meet API  ──  spaces.create
   │                 config.artifactConfig.recordingConfig.autoRecordingGeneration = ON|OFF
   │                 config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration = ON|OFF
   │                 config.accessType = OPEN  (aluno externo entra sem bater à porta)
   ▼
encontro acontece normalmente
   │
   ▼
cron (algumas horas depois)  ──  conferenceRecords.list
   │                             conferenceRecords.participants.list
   │                             conferenceRecords.participants.participantSessions.list
   │                             conferenceRecords.transcripts.entries.list  (se houver)
   ▼
Supabase (modelo novo)  ──►  telas novas
   │
   └──►  formacao_meet_presencas (formato antigo, derivado)  ──►  telas que já existem
```

**Autenticação.** Uma conta robô do Workspace (por exemplo `formacao@allos...`) é dona de todos os spaces.
Ela precisa da licença Business Standard ou superior, porque gravação e transcrição dependem da edição.
Uma licença basta: quem precisa dela é o organizador, não os participantes. O refresh token dessa conta fica
guardado no servidor, ou usa-se service account com delegação de domínio. Sem essa centralização, cada
condutor teria que autorizar o app individualmente e o dono do conference record seria outro a cada vez.

**Escopos.** `meetings.space.created` e `meetings.space.settings` para criar e configurar; leitura de
conference records para a ingestão. App marcado como interno no Google Cloud, o que dispensa a verificação
formal do Google.

**Por que cron e não webhook.** A Workspace Events API entrega eventos por Pub/Sub (conferência iniciada e
encerrada, participante entrou e saiu, gravação e transcrição prontas). É bom, mas exige tópico Pub/Sub,
endpoint público e renovação periódica da inscrição. Um cron que roda depois do horário entrega o mesmo
resultado com uma fração da complexidade. Webhook fica para a fase em que o painel precisar mostrar
presença ao vivo.

**Janela de 30 dias.** As entradas de transcrição ficam disponíveis por 30 dias após a conferência. A
ingestão precisa acontecer dentro desse prazo, e o cron diário já cobre isso com folga.

## 5. O problema da identidade, e a solução

A API devolve, para participante logado, um ID interno e o nome exibido. **Não devolve e-mail.** Como os
alunos entram com conta Google pessoal (o link circula por WhatsApp e pela plataforma), o que chega é
"Ana Paula", não "ana@...".

Três peças resolvem, em ordem de custo:

1. **Tabela de apelidos** (`formacao_meet_aliases`). Nome exibido amarrado a um aluno. Resolvido uma vez,
   vale para sempre. Depois de dois ou três encontros, quase tudo casa sozinho.
2. **Entrada pela plataforma.** O botão de entrar no encontro fica no Allos, autenticado. O clique registra
   quem é, com identidade certa. O casamento deixa de ser contra a base inteira e passa a ser contra os
   quinze que clicaram naquele horário. Resolve homônimo e resolve "iPhone da Ma".
3. **Tela de conciliação.** Fila dos nomes não reconhecidos, com sugestão por similaridade, resolvida em
   poucos cliques. Enquanto não resolvida, a pessoa entra na estatística agregada e fica fora da individual.

Sem isso, o sistema entrega quórum agregado (que já é mais do que existe hoje) mas não entrega histórico por
pessoa, que é metade do valor.

## 6. Modelo de dados

Tabelas novas, mantendo `formacao_meet_presencas` viva por derivação para não quebrar
`/admin/estatisticas`, `/admin/condutores`, `/admin/atividades`, `/admin/calendario` e `/admin/quorum`.

```sql
-- o encontro agendado, e o space criado para ele
formacao_meet_agendamentos (
  id, slot_id, atividade_nome, condutor_id, condutor_nome,
  data_prevista, hora_prevista, duracao_prevista_min,
  space_name, meeting_code, meeting_uri,
  gravar bool, transcrever bool, notas bool,
  criado_por, created_at
)

-- o que de fato aconteceu (um conference record)
formacao_meet_encontros (
  id, agendamento_id, conference_record_id unique, space_name,
  inicio, fim, duracao_min,
  total_participantes, minutos_totais_somados,
  gravacao_uri, transcricao_uri,
  ingerido_em, status
)

-- uma linha por pessoa por encontro
formacao_meet_participacoes (
  id, encontro_id, participant_api_id, display_name,
  aluno_id null,            -- resolvido via alias ou conciliação
  primeira_entrada, ultima_saida, minutos_presentes,
  n_sessoes, permanencia_pct, atraso_min, saida_antecipada_min,
  minutos_fala null, n_turnos_fala null
)

-- nome do Meet amarrado a aluno
formacao_meet_aliases (
  id, display_name unique, aluno_id, confirmado_por, created_at
)
```

Índices por `data`, `aluno_id`, `condutor_id` e `slot_id`. RLS de admin, no padrão de `is_admin()` da
migration 027. Nada de política aberta de INSERT como a de 2026: quem escreve é o servidor, com service role.

## 7. Fases

**Fase 1, o miolo.** Conta robô, criação do space pelo painel com as três chaves, cron de ingestão de
participantes e sessões, derivação para `formacao_meet_presencas`. Ao fim da fase 1 já existe quórum
automático com minutos por pessoa. É a fase que muda o dia a dia.

**Fase 2, identidade.** Aliases, entrada autenticada pela plataforma, tela de conciliação. Ao fim da fase 2
existe histórico por pessoa e as curvas de retenção passam a fazer sentido.

**Fase 3, fala.** Ingestão das entradas de transcrição, cálculo de minutos falados, turnos, vozes ativas e
concentração. Só nos encontros com transcrição ligada.

**Fase 4, painel.** Curvas por grupo, coortes de retenção, comparação por horário, alertas. Aproveita as
telas de estatística que já existem.

**Fase 5, tempo real (opcional).** Pub/Sub e presença ao vivo durante o encontro.

## 8. Limites conhecidos

* **Chat da reunião não é acessível pela API.** Descartado do escopo por decisão.
* **Microfone, câmera, mão levantada e reações não são expostos.** O proxy de participação é tempo de fala,
  que só existe com transcrição.
* **Sem transcrição, não há medida de fala.** Encontros sem gravação rendem só presença e tempo.
* **Nome exibido é editável pelo próprio usuário.** Quem quiser burlar, burla. O sistema serve para
  enxergar tendência, não para fiscalizar indivíduo.
* **Presença não é participação.** Ficar 90 minutos com a câmera fechada e o microfone mudo conta como
  presença cheia. É por isso que vozes ativas importa mais do que quórum.

## 9. Transparência e cuidado com os dados

Isso mede pessoas em formação, algumas delas falando de material clínico. Três compromissos que precisam
estar escritos antes da primeira linha de código:

1. **Aviso claro.** Os participantes sabem que presença e tempo são registrados, e para quê. O Meet já
   sinaliza gravação na tela, mas o aviso pedagógico é outro e é nosso.
2. **Uso pedagógico, não punitivo.** Os números servem para decidir horário, apoiar condutor e procurar
   quem está sumindo. Não para ranquear aluno publicamente nem para justificar desligamento.
3. **Conteúdo não entra no banco.** Só duração e contagem. A transcrição fica no Drive do organizador, com
   política de retenção definida, e o texto das falas não é copiado para o Supabase.

## 10. Custos

**Custo zero:** Meet REST API (não cobra por chamada, só impõe quota), People API, Admin SDK, projeto no
Google Cloud como app interno, cron na Railway que já existe, linhas no Supabase (na ordem de 750 por mês,
irrelevante), e notas automáticas, que desde 2026 vêm incluídas no Business Standard sem add-on.

**Armadilha cara evitada:** app externo com escopos sensíveis exigiria avaliação de segurança do Google
(CASA), que custa milhares de dólares por ano. App interno ao domínio dispensa a verificação inteira.

**Onde pode custar, e como não custar:**

1. *Licença da conta organizadora.* Criar um usuário novo no Workspace é uma licença a mais por mês. Não é
   necessário: qualquer conta já licenciada do domínio pode ser a dona dos spaces. Usar uma conta existente
   zera esse item.
2. *Armazenamento no Drive.* Vídeo de gravação é o único item que cresce, na ordem de 300 a 500 MB por
   encontro de 90 minutos. Transcrição é um Doc de poucas centenas de KB e não pesa. **Para as métricas
   deste projeto, gravar vídeo é desnecessário: presença, tempo e fala saem da transcrição.** Ligar vídeo
   apenas quando houver razão pedagógica própria, com política de descarte.
3. *Pub/Sub, na fase 5.* Cabe folgado no free tier, mas exige faturamento habilitado no projeto Cloud.
   Mais uma razão para ficar no cron enquanto não houver necessidade de tempo real.

**Atenção com data marcada:** a partir de 21/09/2026, notas automáticas por IA passam a vir ligadas por
padrão em Business Standard e Business Plus para reuniões com três ou mais participantes. Sem ação no
admin, os encontros da Formação passam a gerar documentos de notas sozinhos, com conteúdo que pode ser
clínico. Decidir isso conscientemente antes da data.

## 11. Estado da implementação (03/08/2026)

Construído e publicado. Falta apenas ligar as credenciais e rodar a migration.

**Banco:** `supabase/migrations/051_meet_api.sql`. Sete tabelas mais a coluna
`conference_record_id` em `formacao_meet_presencas`, que é o que torna a derivação idempotente.

**Código:**

| Arquivo | Papel |
|---|---|
| `src/lib/meet/client.ts` | OAuth e chamadas à API, sem dependência nova |
| `src/lib/meet/ingest.ts` | o miolo: lê conferências, calcula tudo, grava, deriva |
| `src/lib/meet/nomes.ts` | normalização, similaridade e datas no fuso certo |
| `src/lib/meet/excecoes.ts` | aplica e reverte "nesta data não grava" |
| `src/lib/meet/auth.ts` | porteiro admin das rotas |
| `api/admin/meet/oauth` + `/callback` | consentimento pelo painel, sem terminal |
| `api/admin/meet/spaces` | cria a sala do slot, liga e desliga artefatos |
| `api/admin/meet/aliases` | fila de conciliação e amarração retroativa |
| `api/admin/meet/excecoes` | agenda exceção por data |
| `api/admin/meet/ingerir` | busca sob demanda pelo botão |
| `api/admin/meet/status` | estado do módulo sem expor o token |
| `api/meet/cron` | batida periódica, protegida por segredo |
| `admin/meet/page.tsx` | painel em três abas, na aba Meet da Formação Base |

**Decisão que mudou no meio:** a sala é permanente por slot, não criada por data, porque
`formacao_slots` é grade semanal fixa. Cada semana vira um conference record novo dentro da mesma
sala. Isso eliminou a tabela de agendamentos que estava prevista na seção 6.

**Falta:** `GOOGLE_MEET_CLIENT_ID` e `GOOGLE_MEET_CLIENT_SECRET` na Railway, rodar a migration,
autorizar a conta pelo painel, criar as salas e apontar o cron para
`/formacao/api/meet/cron` com o header `Authorization: Bearer <MEET_CRON_SECRET>`.

## 12. Pré-requisitos operacionais

- [ ] Confirmar edição do Workspace e que a gravação está habilitada no admin
- [ ] Criar a conta robô e dar a licença
- [ ] Projeto no Google Cloud, app interno, ativar Meet API e People API
- [ ] Tela de consentimento e escopos
- [ ] Guardar refresh token da conta robô nas env vars do Railway
- [ ] Definir o texto do aviso aos participantes
- [ ] Definir retenção das gravações no Drive
