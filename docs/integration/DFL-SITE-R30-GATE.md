# DFL SITE R30 — Gate de liberação segura (P9 e WhatsApp)

## Estado verificado antes da cirurgia (08/11/2026)
- HEAD do Site: `f4230bf06f9feb256d38e0940b1d47b0007b42d2` (R29).
- Vercel production: READY, confirmado para o mesmo SHA.
- Supabase DFL - Finance `bwggczkzsqcdeayyysmx`: `dfl-tracking-provider-handoff` v2 ACTIVE, preflight sem envio.
- Não existem, nas variáveis Vercel de produção disponíveis à auditoria, as credenciais e flags novas exigidas pela R27 (foram mantidas ausentes/OFF).
- As permissões de alteração dos secrets da Edge Function Supabase não estão disponíveis pela conexão atual. Nenhum segredo foi criado ou exposto.

## O que a R30 entrega
1. R27 só considera a permissão de envio presente quando `DFL_SITE_TRACKING_AUTO_KILL_SWITCH` é explicitamente a string `false`. Ausente, `true`, `0`, `False` e vazia bloqueiam.
2. O Admin R29 passa a validar formato UTC do marco de ativação. Ter um campo preenchido não basta, e nenhum valor autoriza envio por si só.
3. A política pura `r30ReleasePolicy.ts` separa status de credenciais, autenticação S2S, configuração da Evolution e a situação dos dois interruptores.
4. Mesmo que todos os indicadores técnicos estejam verdes, **não** gera um certificado de liberação: Entregas P9 e um canário consentido com comprovante real permanecem exigidos.
5. No Admin → Central de Mensageria → Ferramentas avançadas → DFL 360 → Verificar integração, o painel mostra o motivo concreto de bloqueio. Não gera link, não acessa o pedido nem dispara mensagens.
6. Atualiza o teste histórico R29 que tratava falta do interruptor como se fosse liberação de envio; preserva o restante das regressões.
7. Não altera checkout, pagamento, frete, Firestore Rules, vendas reais, Supabase Edge Function, bot financeiro, webhook WhatsApp ou configuração Vercel.

## Estado e próximos passos
- Enquanto faltarem segredos no Supabase e Vercel, espere `Automação bloqueada até completar a homologação`.
- Configurar secrets pelo painel seguro do Supabase: `DFL_TRACKING_HANDOFF_SHARED_SECRET` (dedicado, randômico, mínimo 32 caracteres); `DFL_TRACKING_HANDOFF_SITE_APIKEY` (secret API key do projeto); `DFL_TRACKING_HANDOFF_ENABLED=false`; `DFL_TRACKING_HANDOFF_KILL_SWITCH=true`.
- No Vercel, vincular com `DFL_SITE_TRACKING_PROVIDER_PROJECT_REF=bwggczkzsqcdeayyysmx`, `DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL=https://bwggczkzsqcdeayyysmx.supabase.co/functions/v1/dfl-tracking-provider-handoff`, `DFL_SITE_TRACKING_PROVIDER_APIKEY` e `DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET`. Segredos no servidor, jamais `NEXT_PUBLIC_`.
- Ainda **não** ligar `DFL_SITE_TRACKING_AUTO_WORKER_ENABLED` nem definir `DFL_SITE_TRACKING_AUTO_KILL_SWITCH=false` em produção.
- Quando o pré-voo autenticado confirmar a Evolution configurada e ambos os envios estiverem OFF, preparar apenas canário de número autorizado com consentimento e teste de emissão única pelo Entregas. Nunca testar com pedido real de cliente sem autorização.

## Critério de liberação
- `preflight` válido: sem chamada à Evolution, sem token/telefone, sem escrita em banco, autenticado com duas credenciais.
- Entregas: capability AUTOMATIC_CERTIFIED, HMAC, aceite comercial único, `issue_initial` único, sessão segura 24h/30min, token efêmero 45min.
- Provedor: resposta aceita por API **não significa** mensagem entregue ou lida. Resultado desconhecido exige revisão humana; nada de novo link ou envio de segunda tentativa.
- Publicação R30 não liga nenhum dos flags e não altera as funções Supabase.

## Gates e rollback
O instalador verifica SHA256 de todo o pacote, Git HEAD e Git blobs exatos, regressões R24–R29, R30 hermética (70 verificações), TypeScript do repositório e diff. Usa `git add` exclusivamente nos nove caminhos R30. Caso falhe antes do commit, restaura apenas os seis arquivos alterados e remove os três novos. Em falha após o commit, preserva commit local para recuperação manual.
