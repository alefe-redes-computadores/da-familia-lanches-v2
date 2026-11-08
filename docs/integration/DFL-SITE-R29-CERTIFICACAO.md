# DFL SITE R29 — pré-voo seguro e homologação P9

## Entrega auditada em 08/11/2026

- Base Site: commit `b5f5fa4c32ea8f7eca8f83010ff4326cdc0f0e96` (R28), Vercel production READY antes da cirurgia R29.
- Supabase DFL - Finance: projeto `bwggczkzsqcdeayyysmx` (compartilhado por limite de projetos).
- Edge Function exclusiva: `dfl-tracking-provider-handoff` — **versão 2 ACTIVE**.
- A função v2 mantém contrato R28 de envio único e acrescenta preflight via `x-dfl-tracking-preflight: 1` para servidores confiáveis.
- RLS da tabela `public.dfl_tracking_provider_attempts_v1`: `ON`; sem SELECT para `anon` e `authenticated`; zero registros no teste de implantação.
- As funções `whatsapp-webhook` (v166), `dfl-messaging-worker` (v19) e `dfl-messaging-ingest` (v10) não foram substituídas.

## O que a R29 adiciona ao Site

1. API GET administrativa `/api/admin/dfl360-certification` com Firebase `verifyIdToken(token,true)` + validação de admin; `no-store`.
2. Política pura e fail-closed de checklist R27/R28 (flags e credenciais do servidor apenas como **booleanos**, sem valores).
3. Pré-voo acionado manualmente no Admin → Central de Mensageria → Ferramentas avançadas → DFL 360.
4. Quando o Site **ainda não** tem credenciais R27, a rota tenta um GET de presença do receptor; HTTP 405 significa somente URL acessível, jamais prova credenciais.
5. Com credenciais R27 válidas, solicita à Edge Function v2 uma mensagem de preflight com **3 campos públicos e sem pedido, cliente, telefone ou token**. Mesmo com envio OFF, o receptor autenticado consegue dizer se existe configuração Evolution e se as flags de envio estão liberadas.
6. Interface deixa explícito `customerDeliveryVerified=false`, sem afirmar que houve recebimento ou leitura no WhatsApp.

## Proteção operacional

- Ações de pré-voo não lêem ou alteram `Pedidos`, não chamam `r25SendInitialOnce`, não geram link, não chamam Evolution, não gravam Firestore/Postgres e não usam outbox.
- O receptor mantém exigência de **duas credenciais** antes de executar o preflight: `apikey` de serviço + `x-dfl-tracking-provider-secret`.
- Requisições de pré-voo com campos extras, token, telefone ou pedido são recusadas.
- O caminho de envio da R28 exige `DFL_TRACKING_HANDOFF_ENABLED=true` e `DFL_TRACKING_HANDOFF_KILL_SWITCH=false` separadamente; não foram alterados.
- O Site mantém toda a automação R27 OFF; a R29 não altera nenhuma variável Vercel ou secret Supabase.
- Mensagens enviadas pela API do provedor não comprovam entrega/leitura. Erro incerto deve ir para revisão, sem novo token.

## Passos futuros antes da ativação real

**Configuração de segredos (ainda não executada):** Supabase Dashboard → Edge Functions → Secrets; provisionar `DFL_TRACKING_HANDOFF_SHARED_SECRET` (aleatório dedicado 32–512 chars) e `DFL_TRACKING_HANDOFF_SITE_APIKEY` (chave de serviço `sb_secret_...`), sem reutilizar o segredo do bot financeiro. Manter `DFL_TRACKING_HANDOFF_ENABLED=false` e `DFL_TRACKING_HANDOFF_KILL_SWITCH=true`.

**Site Vercel:** variáveis `DFL_SITE_TRACKING_PROVIDER_PROJECT_REF=bwggczkzsqcdeayyysmx`, `DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL=https://bwggczkzsqcdeayyysmx.supabase.co/functions/v1/dfl-tracking-provider-handoff`, `DFL_SITE_TRACKING_PROVIDER_APIKEY` (mesma chave de serviço), `DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET` (mesmo segredo dedicado). Nunca `NEXT_PUBLIC_`. Manter as flags R27 de envio e certificação desligadas.

**Pré-voo:** no Admin, acionar a verificação manual. Esperar status `authenticated` e `providerConfigured=true`, mas `deliveryEnabled=false` enquanto o kill switch ainda estiver ativo. Verificar a resposta sem contato a Evolution e sem registros na tabela.

**Canário:** somente após Entregas P9 `AUTOMATIC_CERTIFIED`, consentimento explícito e teste com número autorizado; conferir autorização, status terminal, idempotência, um link P9, ACK real da API, abertura segura da sessão e auditoria de logs sem token. Confirmação real da entrega ao cliente exige fonte do provedor, não apenas HTTP 2xx.

## Gates no Termux

O instalador R29 exige o HEAD R28 exato, cria backup do único arquivo alterado, aplica nove arquivos novos, testa o código da Edge Function hermeticamente e executa as regressões anteriores R24–R28, TypeScript global e diff check. Só faz commit/push com `--publicar` e gates aprovados. Em falha antes do commit restaura **somente arquivos R29**.
