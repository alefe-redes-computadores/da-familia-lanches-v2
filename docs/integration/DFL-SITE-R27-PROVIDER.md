# DFL Site R27 — transporte inicial WhatsApp (OFF por padrão)

## Objetivo e decisão

R27 conecta R23 (aceite comercial), R25 (grant P9 único) e R26 (observabilidade) a uma fila inicial R27 de **não repetição**. Publicação do código **não ativa automação**. Não altera checkout, preços, pedidos históricos, Firestore Rules, WhatsApp oficial existente nem worker Supabase atual.

O provedor do disparo inicial ainda precisa implementar e homologar uma **nova Edge Function dedicada**, `dfl-tracking-provider-handoff`. Não apontar R27 para `dfl-messaging-ingest` ou qualquer outbox persistente: o link contém token de uso único e jamais pode ser persistido em banco, log, analytics, métricas, fila Supabase ou retry automático.

## Sequência

1. Admin aceita pedido. R23 confirma a transação Firestore e repassa o aceite a Entregas via HMAC, consentimento explícito e idempotência.
2. **Somente quando TODAS as gates R27 estão habilitadas**, e aceitos **depois** de `DFL_SITE_TRACKING_AUTO_ACTIVATED_AT`, o ACK R23 cria um job R27 `pending` na mesma transação. Pedidos anteriores ao instante de ativação não geram jobs por backfill.
3. Worker privado reclama **uma vez** o job via transação. Em `processing`, um crash não retorna automaticamente à fila. Conferir e resolver manualmente; nunca reprocessar pelo mesmo job.
4. R25 reserva atomicamente uma única emissão. Entregas P9 devolve token exclusivamente ao backend Site em memória. O backend valida o estado real do pedido e chama UMA vez a Edge Function dedicada via HTTPS no path fixo, sem redirects, logs ou replay.
5. A resposta da função é `accepted_by_provider`, `delivery_uncertain` ou `rejected_by_provider` com ID de evento. O Site reporta `provider_receipt` ao Entregas. Aceite do provedor **não significa** entrega/leitura pelo cliente. Estados incertos exigem revisão, não retry.
6. Admin > Central de Mensageria > Ferramentas avançadas > DFL 360 permite consultar amostras de quatro filas, sem revelar PII, links, tokens ou segredos.

## Contrato do novo receptor (a implementar no projeto Supabase da mensageria)

**POST** `/functions/v1/dfl-tracking-provider-handoff`, HTTPS, projeto Supabase com project ref correspondente ao Site. Nunca redirecionar ou logar o payload. Autenticar no nível da plataforma via header `apikey: sb_secret_...` e no próprio handler validar `x-dfl-tracking-provider-secret` antes de ler/processar o link. Em Supabase, use `verify_jwt=false` APENAS se implementar autenticação de serviço robusta na função. Não usar o endpoint existente de ingest/outbox.

Request efêmero, enviado uma única vez (não é uma fila):

```json
{
  "contract":"dfl.tracking.provider.v1",
  "version":1,
  "action":"send_tracking_initial",
  "canonical_order_key":"site:ORDER_ID",
  "recipient_e164":"+5534999999999",
  "tracking_link":"https://dafamilialanches.com.br/acompanhar#t=TOKEN_EFEMERO",
  "expires_at":"2026-11-08T21:00:00.000Z"
}
```

Reply estrita com **exatamente 6 campos**, content-type JSON e status HTTP 2xx:

```json
{
  "contract":"dfl.tracking.provider.v1",
  "version":1,
  "action":"send_tracking_initial",
  "result":"accepted_by_provider",
  "provider_event_id":"PROVIDER_EVENT_ID",
  "customer_delivery_confirmed":false
}
```

O receptor deve encaminhar o texto efêmero diretamente à API oficial/credenciada do WhatsApp, sem incluir a URL em recursos persistentes ou webhooks. Deve devolver ID e resultado, sem ecoar token. Se a API do provedor falhar, devolver um resultado inequívoco somente quando conhecido; qualquer timeout é `delivery_uncertain` no Site e exige revisão.

## Variáveis novas — todas OFF/ausentes após a instalação

- `DFL_SITE_TRACKING_AUTO_WORKER_ENABLED=1` (permissão adicional para criar/tratar jobs).
- `DFL_SITE_TRACKING_AUTO_ACTIVATED_AT=<ISO_UTC_AGORA>` (marco explícito de início; nunca usar data histórica).
- `DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED=1` (somente após validação real da função dedicada).
- `DFL_SITE_TRACKING_PROVIDER_PROJECT_REF=<ref_supabase>` (mesmo host, entre 15 e 32 caracteres alfanuméricos minúsculos).
- `DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL=https://<ref>.supabase.co/functions/v1/dfl-tracking-provider-handoff` (exata; sem query/fragment).
- `DFL_SITE_TRACKING_PROVIDER_APIKEY=sb_secret_...` (chave de serviço protegida, nunca `NEXT_PUBLIC_`).
- `DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET=<segredo-dedicado-32-a-512-caracteres>` (autenticação adicional no receptor).
- `DFL_SITE_TRACKING_AUTO_KILL_SWITCH=true` (opcional, bloqueia quando true; não configura chaves nem ativa nada).

Continuam obrigatórias: `DFL_SITE_TRACKING_ENABLED=1`, `DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED=1`, `DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED=1` e `DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED=1`. Entregas requer P9 certificado com sua própria capability `AUTOMATIC_CERTIFIED`, tenant e HMAC. Não ativar sem testar os dois lados e o provedor real.

## Homologação antes de habilitar

- Testes sem clientes reais: requisições inválidas, 401/403, replay, consentimento revogado, mudança de telefone, token único, timeout antes e depois do provider, indisponibilidade Firestore e worker concorrente.
- Testes controlados autorizados: checkout real de teste e aceite, Entregas confirmado, emissão única, retorno do provedor, consulta do link e conclusão; prova de que nenhum token aparece em logs/DB/outbox e que atrasos nunca revertem terminalidade.
- Verificar métricas de produção e roteamento SSL no novo endpoint. R27 **não** cria/deploya a função Supabase e **não** ativa flags.

## Rollback e risco operacional

O instalador cria backup isolado e só faz commit/push se validações passarem. R27 só toca quatro filas em leitura ou escrita quando o worker configurado. A UI fica com diagnóstico manual e somente admin. A instalação deve ocorrer mesmo com site aberto pois as flags continuam OFF; homologação de envio real em outra janela.
