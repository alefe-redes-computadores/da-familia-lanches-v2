# DFL SITE R31 — autenticação P9 com a mensageria já existente

## Base verificada
- Site R30: HEAD 89416e141860f47b1793796facdbb6b3a85775ba; produção Vercel READY.
- Supabase Finance: bwggczkzsqcdeayyysmx; função P9 v2 ACTIVE antes da R31.
- Outbox original Site / Entregas / Manual já registra ACK da Evolution; NÃO foi reescrito nem substituído.

## Escopo da macrocirurgia
1. O P9 tem função dedicada e ainda NÃO entra na fila durável `dfl_messaging_outbox` (token de uso único).
2. Reutiliza **credenciais existentes** `DFL_MESSAGING_INGEST_TOKEN` e `DFL_MESSAGING_WORKER_TOKEN` nos dois servidores, desde que separadas e com 24+ caracteres. Nenhum segredo novo obrigatório.
3. Requisição é assinada por HMAC-SHA256 duplo e domain-separated `DFL-P9-R31`, sobre timestamp + JSON original. Janela de autenticação de 90 segundos. Não envia tokens brutos.
4. Endpoint é fixo: https://bwggczkzsqcdeayyysmx.supabase.co/functions/v1/dfl-tracking-provider-handoff.
5. Suporta preflight sem pedido/telefone/token e com envio OFF; o Admin indica o modo de autenticação.
6. Mantém suporte às credenciais dedicadas anteriores, se um dia forem provisionadas; receptor evita duplicações usando mesmo HMAC de pedido em ambas as vias quando token worker existente.
7. Mantém OFF todos os gates de envio automático: R27 exige seis flags `=1`, ativação UTC, `DFL_SITE_TRACKING_AUTO_KILL_SWITCH=false`; Supabase exige `DFL_TRACKING_HANDOFF_ENABLED=true` e `DFL_TRACKING_HANDOFF_KILL_SWITCH=false`. Este pacote NÃO altera env.

## Homologação
- Primeiro testar o Admin → Mensageria → Ferramentas avançadas → DFL 360 → Verificar integração. Esperado: dupla assinatura autenticada, provider configurado (se URL Evolution HTTPS), envio remoto OFF.
- Presença de credenciais e callback 200 NÃO comprovam a chegada da mensagem no telefone.
- Não enviar canário com um pedido real antes de certificar Entregas P9 e consentimento explícito. Não realizar retentativas em tokens incertos.
- Nenhum número de teste novo ou instância Evolution nova é necessário.

## Segurança, dados e rollback
- Nenhum link, telefone ou token é colocado em Firestore, Postgres, telemetria ou fila antiga; função exclusiva continua com tabela de HMAC `dfl_tracking_provider_attempts_v1`, RLS privada.
- A R31 substitui apenas a versão da nova função P9 no Supabase, nunca `whatsapp-webhook`, `dfl-messaging-worker`, `dfl-messaging-ingest`.
- Para rollback de código da função isolada: reimplantar os arquivos versionados de R29. Como os envs OFF, a versão R31 não altera operação atual.
- O instalador Site exige HEAD R30, checa SHA256, backups, testes R24–R31, TypeScript global e push somente com gates aprovados.
- `docs/integration/r31-provider/*.ts.txt` são cópias de arquivo de Edge Function, fora do `tsconfig` do Next.js. Não publicar segredos no Git.
