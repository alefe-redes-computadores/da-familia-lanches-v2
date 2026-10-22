# DFL Site V85.1 R6 — Duas vias para a bobina

**Estado:** somente impressão manual em janela de prévia, USB genérica sem conexão direta. Nenhuma automação, ponte, credencial ou comando de corte.

## Via Preparo / Cozinha

Prioriza número do pedido, modalidade (entrega/retirada), cliente, status, agendamento, itens, adicionais, observações por item e gerais. Oculta telefone, endereço e dados comerciais **na impressão**, reduzindo a exposição de dados e economizando bobina.

## Via Completa

Preserva os dados da R5 para expedição/entrega: nome, telefone, status, agendamento, endereço, itens, adicionais, observações, subtotal, taxa, desconto, cupom, pagamento, troco e total, se constarem no pedido.

## Segurança operacional

- Pedido marcado **Cancelado** mostra `CANCELADO — NÃO PRODUZIR` nas duas vias.
- Pedido marcado **Agendado** mostra `PEDIDO AGENDADO — CONFERIR HORÁRIO` nas duas vias.
- Sem impressão no carregamento da janela. Seleção 58/80 mm e teste curto R5 permanecem.
- Uma escolha da via não persiste endereço, valores, números de telefone ou outros dados do cliente no computador.
- A via muda só a exibição CSS: não altera nem grava pedido comercial.

## Testes físicos antes da automação

1. Selecionar impressora correta no notebook; confirmar driver, papel nominal e margens.
2. Usar **Conferir largura** da R5 e imprimir só o teste curto.
3. Se o teste estiver alinhado, imprimir uma **via Preparo** de pedido antigo ou fictício.
4. Conferir observações, acentos, itens e bordas. Depois, imprimir uma **via Completa**.
5. Somente após validar as duas vias discutir instalação da ponte USB autenticada para impressão sem interação e filas idempotentes.

**Futuro:** um serviço local autorizado no notebook aceita jobs autenticados, fila com status e tentativas, deduplicação por origem+pedido+tipo de via+revisão, credenciais protegidas, e integrações Site/iFood/99Food por canais oficialmente disponíveis. Não deduzir que USB genérica é ESC/POS nem enviar comando direto sem teste.
