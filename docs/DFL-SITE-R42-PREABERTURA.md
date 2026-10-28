# DFL SITE — R42 | Operação segura antes da abertura

Versão da base: R40 (`ce14c500aa450575604d468cc1f8aa6944b88cb0`).
A R42 publica a R41 (painel de abertura) e adiciona testes de proteção de vendas. Não altera API de criação de pedidos, preço de frete ou sincronização com Entregas.

## Conferência antes da abertura

1. Abra o site público no celular e confira catálogo, preços, produtos esgotados e adicionais obrigatórios.
2. Confirme modo de funcionamento (automático/manual), horários e exceções do dia no Admin.
3. No painel operacional, use **Atualizar transporte**. Observe pendentes, processando, falhas, quarentena e idade do snapshot.
4. Abra o DFL Entregas e verifique a **Caixa de Entrada**. Fila de eventos zerada no Site não comprova que o destino recebeu um pedido.
5. Faça, se a operação permitir, um **pedido controlado real**, acompanhando a confirmação do Site, a chegada **uma única vez** na Caixa de Entrada e o tratamento adequado. Não use script para fabricar pedidos em produção.
6. Teste endereço normal, bairro com erro de digitação e fallback manual. Verifique a taxa pelo bairro cadastrado. A prévia da Geoapify é opt-in e **não cota frete**.
7. Copie o diagnóstico do painel em caso de problema. O relatório não inclui nomes, telefones nem endereços.

## Se ocorrer problema

- **Confirmação incerta de pedido**: não envie novamente nem use o WhatsApp como segundo pedido antes de verificar Meus Pedidos e a operação.
- **Evento parado/falhou/quarentena**: preservar logs e identificar o ID do evento antes de qualquer reprocessamento, sempre de forma idempotente.
- **Geoapify ou CEP indisponível**: cliente pode preencher bairro, rua e número manualmente. Não fixar frete pela distância aproximada.
- **Erro remoto**: não considerar o último snapshot como atual.
- **Site fora do ar**: consultar deploy Vercel e Actions do commit, preservando informações e sem reset forçado.

## Termux / GitHub

- Projeto: `~/projects/da-familia-lanches-v2`.
- Manter 4G se o Wi-Fi estiver com timeout para GitHub.
- Gate: `node scripts/test-site-v88-v90-release-gate.cjs` (55 suítes + TypeScript; sem `next build`).
- Gate R42: `node scripts/test-site-r42-launch-freeze.cjs`.
- Verificação pública opcional e somente leitura: `node scripts/check-site-r42-public-readiness.cjs`.
- O instalador só faz `git add` dos caminhos manifestados, `git push` sem `--force`, e NÃO usa `git reset`/`git clean`.

## Escopo e limitações

A certificação estática comprova propriedades do código, **não** a entrega real de eventos nem o funcionamento de um checkout público sob carga. A conferência manual do aplicativo Entregas e de um pedido controlado ainda é necessária. Não habilitar flags Geoapify automaticamente na véspera da abertura.
