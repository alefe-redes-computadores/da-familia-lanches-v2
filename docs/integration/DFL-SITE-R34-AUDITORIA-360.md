# DFL SITE R34 — Auditoria de mensageria por pedido · 08/11/2026

## O que muda
- Nova Edge Function read-only `dfl-messaging-audit` no Supabase **DFL - Finance**. Usa o token S2S já existente `DFL_MESSAGING_WORKER_TOKEN` na comunicação servidor-servidor; nenhum novo WhatsApp, instância ou telefone.
- Consulta SOMENTE `public.dfl_messaging_outbox` por `source` + `order_id` e evento opcional. Índice `dfl_messaging_outbox_order_idx` existente. Retorna no máximo 24 registros, sem payload, telefone, nome, endereço, identificador bruto do provedor, URL, conteúdo ou segredo.
- Nova rota Next.js somente Admin `GET /api/admin/messaging-360-audit` verifica Firebase com revogação e perfil admin, então solicita o diagnóstico ao endpoint Supabase fixo.
- Nova seção em Admin > Central de Mensageria > Ferramentas avançadas, junto da auditoria R32 de `order.ready`. Permite origem Site, Entregas ou manual, ID de pedido e tipo de evento. Sem polling, replay, wake ou escrita.

## Estados, não promessas
- `pending`: ainda não processado; `processing`: em processamento; `sent`: a API do provedor aceitou (quando houver recibo); `failed`/`dead_letter`: investigar; lista vazia: nenhum registro nesta fila para o filtro selecionado.
- `customerDeliveryVerified=false`: a auditoria NÃO mede recebimento ou leitura do WhatsApp.
- Mensagens suprimidas pelo R11/R24 antes da fila ficam no Firestore e são investigadas separadamente pelo painel R32.

## Segurança e operação
- Não há habilitação automática de flags de envio. R300 P1/P2/P3 do Entregas não foi publicada na verificação inicial da R34.
- Preserva `dfl-messaging-ingest` v11, `dfl-messaging-worker` v22, `dfl-tracking-provider-handoff` v3 e `whatsapp-webhook` v166, sem alterar essas funções.
- Não inclui credenciais no Git. Endpoint Supabase R34 exige header privado `x-dfl-messaging-worker-token` (mesmo segredo já existente) e request de contrato estrito. Uma leitura indexada por requisição, sem operação de escrita.
- A Edge Function foi criada com `verify_jwt=false` PORQUE aplica autenticação própria antes de parsear a requisição. Nunca expor o token ao navegador.

## Homologação
1. Rodar o pacote R34 no Site, com gates de TS completo, regressões e commit/push após sucesso.
2. Admin: testar consulta por ID de pedido real conhecido; comparar estado com a análise Firestore existente. Não reenviar.
3. Para pedidos manuais: digitar `dfl-...` (UI adiciona o prefixo) ou `entregas:dfl-...`. Confirmar eventos `order.created`, `order.ready` ou `delivery.next_stop` apenas se estiverem liberados pelo Entregas e pelos gates canário.
4. Confirmar que sem credencial/autorização o resultado é erro, sem vazamento de dados. Sem consentimento, não habilitar notificações.
5. A próxima homologação ponta a ponta continua dependente da R300 e das flags independentes de canário. R34 não habilita essas flags.

## Nota de arquitetura
O Site e o Entregas continuam proprietários de suas etapas: Site é autoridade comercial dos pedidos criados pelo Site, Entregas é autoridade das paradas físicas e dos pedidos manuais. Supabase apenas recebe, aplica regras e registra o resultado operacional da API do provedor. Esta auditoria não infere transições físicas nem modifica estado comercial.
