# DFL Site — V87 R3 · Global Premium Experience

## Implementado sem novos reads Firebase

1. Admin Quick Switcher com acesso rápido a 15 funções, pesquisa sem acento, seleção por teclado e atalhos Ctrl/Cmd+K. Botão móvel no topo e botão desktop, integra as abas reais, central de notificações, operação da loja e pedidos prioritários. Não cria API/Firestore.
2. Página individual do produto: CTA contextual fixo acima da navegação inferior do celular, apenas quando o CTA principal saiu da tela, com `IntersectionObserver` desconectado no unmount. Abre a mesma personalização, respeita disponibilidade e safe-area. Não duplica a adição ou pula grupos obrigatórios.
3. Menu de navegação do cliente: fecha com Escape e ao trocar de rota, removendo listeners no teardown.
4. Checkout: foco e toque, scrolling menos intrusivo, tipografia de campos de 16px em smartphone, melhorias no aproveitamento da tela com teclado.
5. Adicionais: foco visível e tamanho de alvos no modal.
6. Estilos de Admin: botões mobile 44px e estados de foco, sem substituição da linguagem premium já existente.

## Confiabilidade e limites
- Mantém V86 (grupos de adicionais, frete, checkout, editor, prontidão), V87 R1 e V87 R2.
- Não altera preços, taxas, persistência de pedidos, mensageria, Firestore Rules, VPS ou bot.
- TypeScript, contratos legados e git diff são executados no Termux.
- Inspecionar manualmente: Android WebView com teclado aberto, modal de adicionais sobre CTA fixo, desktop Admin com Ctrl+K, painel rápido com leitor de tela e disponibilidade de menu.
- Sem publicação automática.

## Referências verificadas
- Toast: dashboard e Quick Actions operacionais.
- DoorDash Merchant: navegação central de menu, modificadores, disponibilidade.
- web.dev: INP e tempo de resposta de interações.
- WCAG 2.2: foco visível e alvos de toque.
- Chrome Android: safe-area de CTA fixo.
