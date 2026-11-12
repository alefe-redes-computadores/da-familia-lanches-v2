# DFL Site R67 — FAST LANE dos links de acompanhamento

## Diagnóstico que motivou esta cirurgia
O Site confirmou três aceites S2S; houve uma tentativa `issue_uncertain_or_rejected` após aproximadamente três minutos do aceite e uma antiga `provider_transport_uncertain`. A R66 confirmou que o pedido mais recente **não tem grant localizável** no Entregas no estado consultado e **está concluído na consulta posterior**, sem prova de que estivesse concluído exatamente ao tentar emitir.

## Mudança técnica restrita a pedidos NOVOS
- Após uma **mudança comercial autenticada**, a função `after()` drena o aceite e, em seguida, o job inicial P9 **do mesmo pedido**. Antes, só o aceite era imediato e a emissão dependia da próxima chamada periódica ao worker, criando atraso evitável.
- Ambos os drenos continuam transacionais, com idempotência, verificação de consentimento, origem, estado, rollout e capability. O cron original continua como recuperação de jobs `pending`.
- Amplia para 60 segundos o teto da função de aceite para acomodar o trabalho posterior à resposta, sem bloquear o clique do Admin.
- Se o job já foi processado, está em revisão, suprimido ou tem resultado incerto, **NUNCA** o drena novamente. Não faz backfill de pedidos antigos nem desperta a fila inteira.
- Log agregado sem ID, telefone, URL, token, segredo ou texto de WhatsApp.

## Não altera
- Configuração do Firebase, Site/Entregas, Evolution, Supabase ou bot financeiro.
- Sistema de pedidos, status, aceites comerciais, checkout, cobrança, catálogo, API P9, token, TTL 45 min ou mensagem enviada.
- Entregas ou pedidos manuais: automação de emissão inicial manual continua fora deste escopo.

## Limites da garantia
- Corrige uma janela de atraso demonstrada, **não garante** que o provedor aceitará um futuro envio. A confirmação exige um pedido novo, autorizado, elegível e monitoramento no WhatsApp.
- Casos antigos `review_required` permanecem isolados; nunca apagar ou reprocessar automaticamente.
- Diagnóstico adicional somente leitura compara `completed_at` com instante da revisão; pode permanecer INDETERMINADO.

## Gates
- R67 com mocks e zero rede, R23/R27/R31/R62 e gate V88-V90 (69 suítes), TypeScript, ESLint, `git diff --check`.
- Aplicação com backup/rollback e publicação somente mediante comando separado, com paths explicitamente manifestados.


## FIX1 — Compatibilidade com o teste legado R27

O teste `scripts/test-site-r27-provider.cjs` usa documentos de resultado de query sem a propriedade `exists` (correto para o contrato da consulta: `docs` contém somente documentos existentes). A versão inicial da R67 ignorava esses documentos, impedindo o teste de executar a tarefa. A FIX1 verifica `.exists` apenas no caminho novo de consulta direta por `targetOrderId`; o caminho original de query/cron fica intacto. Teste R67 reforçado com fixture que reproduz exatamente essa ausência de `.exists` e valida processamento único. Nenhuma alteracao no Supabase, Entregas ou env. Tentativas anteriores em `review_required` nao serao reprocessadas.
