# V88 R4 — Autoridade do funcionamento da loja

- Antes, a consulta fresca do status usada para finalizar pedido podia converter falha de Firestore em configuração padrão, criando uma disponibilidade presumida. A API de pedidos continua sendo autoridade final.
- Agora, `getCheckoutStoreAccess(email, true)` propaga a falha de consulta: a tentativa não avança com disponibilidade inventada.
- Consulta informativa (`forceFresh=false`) preserva o último snapshot confirmado se houver, sem aumentar as consultas e sem alterar regras de abertura.
- Teste de comportamento com remoto aberto/fechado, perda de rede e recuperação. Sem novos listeners e sem migração.
