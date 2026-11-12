# DFL 360 R62 — busca e rollout gradual de links privados

- Site: previsao imediata na busca, Enter/tap desloca aos resultados reais, produtos ordenados pelo motor existente; banner e cards editoriais nao cobrem resultados; ofertas com contraste diferenciado da campanha.
- Site + Entregas: `canary` permanece padrao; `consented_customers` exige dois switches novos, um em cada backend. Outros escopos bloqueiam.
- Todas as protecoes existentes continuam: pedido real do Site, consentimento explicito do checkout, nao opt-out, nao cancelado/finalizado, aceite comercial e logistica certificados, sem envios historicos, marco de ativacao, 45 min, token apenas em memoria, uma emissao por pedido, sem reenvio apos incerteza.
- R62 NAO altera diretamente as configuracoes Vercel, Firebase ou Supabase. A aprovacao local nao libera disparos. Implantar Entregas primeiro, depois Site; auditar readiness e ativar somente apos confirmar que o modo `AUTOMATIC_CERTIFIED` foi configurado no tenant e a ponte/provedor e os interruptores do Site estao preparados.
- Proibido alterar ou desligar testes de checkout, Supabase Finance, bot Finance, Evolution ou mensageria comercial normal.

- R62 FIX1: Entregas novo pedido mostra preferência operacional de aviso pré-marcada; envio real continua dependente de confirmação individual do cliente e pode ser desmarcado sem contaminar pedidos existentes.
- FIX1: teste de telefone não considera telefone brasileiro válido de 8 dígitos como inválido.
