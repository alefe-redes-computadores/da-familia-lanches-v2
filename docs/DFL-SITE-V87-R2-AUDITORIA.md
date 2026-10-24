# DFL SITE V87 R2 — Confiabilidade e experiência premium

## Hipóteses validadas no HEAD c12ade5d
1. `sendAdminNewOrderPush` registrava `processing` antes do envio FCM e tratava qualquer chamada posterior como duplicada, inclusive após falha.
2. Resposta parcial do FCM era marcada `sent` se um único token desse certo; os outros dispositivos deixavam de receber retries.
3. A Central do Admin interpretava um timer de 1,1 s como sucesso ao revalidar push.
4. O modal de produto aumentava a quantidade sem limite, mas a API rejeita linha acima de 30.

## Soluções da R2
- Recuperação v2 sobre `AdminPushDispatches` mantendo o identificador v1: claim transacional, lease de 90s, reenvio por token com hash de token confirmado, seis tentativas por pedido, janela de 60 min e backoff de até 120s.
- Recuperação no worker autenticado **existente** `/api/integration/worker`, limitada a cinco pedidos/tick e três consultas curtas (24+8+8). Não cria cron próprio nem listener.
- Recupera documentos `failed` legados sem re-enviar documentos com status `sent`; previne reenvios de pedidos já cancelados/finalizados.
- Classificação específica para tokens FCM inválidos, desativados sem invalidar o pedido; comportamento tolerante a erros.
- Central do Admin agora indica confirmação de sincronização real ou falha, sem sucesso por cronômetro.
- Limite visual e acessível de 30 unidades por produto, inclusive merge, restauração, recompras e stepper do carrinho, igual ao contrato do checkout.
- Produto individual com pequenas melhorias visuais para hover real, movimento reduzido e touch mobile.
- Home com atalho Ctrl+K para busca (Escape limpa), sem polling e com feedback visual acessível.

## Limitações importantes
- FCM `success` confirma aceite pelo serviço, NÃO que o aparelho exibiu a notificação.
- Se o processo cair após FCM aceitar mas antes do ACK persistir, retry pode repetir aviso; usar `tag` estável diminui duplicação visual, não garante exactly-once.
- O worker precisa realmente ser invocado (scheduler/VPS). Esta cirurgia reutiliza a execução existente, mas não prova que ela está agendada em produção.
- A query por status faz até 40 leituras de documentos retornados por tick, mais até cinco leituras dirigidas de Pedidos quando há pendência; não há nova consulta no fluxo normal do cliente.
- A query limitada não garante justiça perfeita com mais de 24 `retry` simultâneos. Antes de aumentar volume, migrar para índice composto status+nextAttemptAtMs+ordenação para evitar starvation.
- Não foi feita alteração em regras Firebase, VPS, Supabase, Vercel ou segredos de ambiente.

## Referências
- Square: modifier sets e regras min/max (adaptar UX ao contrato atual, não duplicar grupos).
- web.dev: animações baseadas em transform/opacity, interação rápida, reduced motion.
- Firebase Cloud Messaging: tratamento de erros de token e resultados parciais.

## Testes manuais
1. Compra real de teste: um push por aparelho ativo após pedido confirmado.
2. Remover conectividade de teste do servidor FCM (staging): status `retry`, depois worker recupera quando o serviço volta.
3. Confirmar que aparelho com sucesso anterior não recebe novamente push durante retry de outro aparelho.
4. Pedido já cancelado/finalizado não recebe push atrasado.
5. Central de notificações do Admin: 'Revalidar' com rede boa e offline, nunca exibir falso OK.
6. Modal de produto: quantidades 1 e 30; botão + bloqueado após 30; preço correto.
7. Inspecionar leituras Firestore com worker em repouso; ajustar limites se o volume pedir.

## Entrega
- Aplicação local com rollback, TypeScript e regressões do Site e da V86.
- SEM `npm run build` no Termux. SEM commit, push, deploy ou testes destrutivos de produção.
