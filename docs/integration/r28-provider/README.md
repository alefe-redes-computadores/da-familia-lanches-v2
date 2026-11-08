# DFL SITE R28 — Receptor WhatsApp P9 certificado em código (OFF)

## Estado factual em 08/11/2026
- Site R27: HEAD `d2b7405fee39c95cede00ec8de52630ec6168931`; production Vercel READY.
- Supabase `DFL - Finance`: projeto `bwggczkzsqcdeayyysmx`.
- Edge Function dedicada `dfl-tracking-provider-handoff`: implantada ACTIVE versão 1.
- Migração aplicada `20261108214608_r28_tracking_provider_one_shot_receipts`.
- Nova tabela `public.dfl_tracking_provider_attempts_v1` (RLS ON, sem acesso de leitura anon/authenticated, INSERT somente service_role), vazia após migração.
- Funções existentes preservadas: `whatsapp-webhook` v166, `dfl-messaging-worker` v19, `dfl-messaging-ingest` v10.
- Nada foi enviado ao WhatsApp durante a homologação hermética. A conexão não permite configurar Secrets nem invocar HTTP em rede aqui.
- Este pacote só versiona os fontes, SQL, testes e documentação no repositório do Site; não executa novamente a migração nem reimplanta a função Supabase.

## Segurança
O receptor envia o link somente diretamente à Evolution API, sem fila/outbox persistente. Valida o host e formato do link, telefone E.164, TTL, autenticação dupla (secret key + segredo dedicado), e cria reserva HMAC atômica do pedido ANTES do envio. Timeout ou erro incerto exigem revisão, nunca retry. O retorno `accepted_by_provider` indica só ACK da API, não leitura do WhatsApp. O banco não recebe telefone, token nem conteúdo da mensagem.

## Configuração pendente (não realizada por esta cirurgia)
### No Supabase (Edge Function Secrets)
- `DFL_TRACKING_HANDOFF_SHARED_SECRET`: segredo aleatório dedicado, 32-512 caracteres, apenas servidor.
- `DFL_TRACKING_HANDOFF_SITE_APIKEY`: secret API key `sb_secret_...` deste projeto; igual à do Site.
- `DFL_TRACKING_HANDOFF_ENABLED=false` (ficar OFF durante homologação sem disparo).
- `DFL_TRACKING_HANDOFF_KILL_SWITCH=true` (ficar ON até homologação).
- A função existente já usa `DFL_EVOLUTION_*` ou `EVOLUTION_*` mas não lê nem modifica dados do bot.

### No Vercel do Site (R27; somente servidor)
- `DFL_SITE_TRACKING_PROVIDER_PROJECT_REF=bwggczkzsqcdeayyysmx`
- `DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL=https://bwggczkzsqcdeayyysmx.supabase.co/functions/v1/dfl-tracking-provider-handoff`
- `DFL_SITE_TRACKING_PROVIDER_APIKEY`: mesma secret API key Supabase.
- `DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET`: mesmo segredo dedicado.
- Manter `DFL_SITE_TRACKING_AUTO_WORKER_ENABLED`, `DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED`, `DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED`, `DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED` OFF até certificação.

**Não colocar chaves em NEXT_PUBLIC_, GitHub, prints, histórico de mensagens ou checkout.**

## Homologação posterior (sem cliente real primeiro)
Testar função OFF, 401 com autenticação inválida, 422 com contrato inválido, replay 409, pedido cancelado, consentimento e telefones válidos, token 256 bits, TTL 45 min, offline do provedor e ACK parcial. Para envio real, usar apenas número de teste aprovado, com consentimento, e validar Entregas `AUTOMATIC_CERTIFIED` e revogação.

## Termux — versionar e publicar com gates
Extrair o ZIP na pasta Downloads e executar o instalador `--publicar`. Ele verifica HEAD, SHA256, arquivos destinos, Node tests, `tsc`, git diff check, gera backup e faz git add apenas nos arquivos da R28. Sem `--publicar` prepara apenas localmente.
