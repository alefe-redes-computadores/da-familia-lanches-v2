# DFL 360 — R75 P1 (Site)

Ponte de auditoria read-only: Entregas superadmin -> Site HMAC existente -> Supabase dfl-messaging-audit R34 existente.

- POST assinado com janela de 5 minutos, ordem manual estrita, corpo com quatro campos, sem telefone.
- Consulta indexada por pedido no audit Supabase existente; limite de 24 eventos sanitizados.
- Somente estados gravados, nunca confirmação de entrega ao aparelho.
- Zero novos segredos, tabelas, workers, reenvios, mensagens ou grants de tracking.
- Site não autoriza usuário externo: somente ponte HMAC server-to-server com o Entregas que verifica superadmin Firebase e o pedido Firestore.
- Sem atividade se Entregas não chamar a ponte. Rollback seguro: remover somente esta rota.
- Links incertos são um fluxo separado e não podem ser repetidos a partir do audit do WhatsApp.
