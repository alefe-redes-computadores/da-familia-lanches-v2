# DFL SITE V85.1 R10 — fechamento de operação e feedback

- Admin: lista principal busca com prioridade de renderização responsiva; histórico mantém debounce e contratos originais.
- Atenção: pedido sem atualização há mais tempo aparece primeiro no atalho de prioridade, sem leitura nova.
- Relógio operacional para de recalcular UI em segundo plano e recupera ao voltar.
- Notificação móvel inclui contagem em seu rótulo acessível.
- Gestos e botões essenciais com alvos de toque mais confortáveis.
- Pesquisa de satisfação bloqueia cliques repetidos, tem timeout de 9s e permite reenvio quando falha.
- Sem modificação nos contratos do Entregas, Firestore, financeiro, checkout, impressão automática ou bancos.

## QA após publicação expressamente autorizada
1. Abrir a Gestão no Android e navegar Loja, Cardápio, Saúde, Agendados, Cupons, Fidelidade.
2. Testar foco do inspetor, histórico, alterações de status sem testar em pedido real.
3. Verificar filtros com muitos pedidos, busca, alerta mais antigo e retorno após segundo plano.
4. Site: busca, promoções, favoritos? (não criado), último pedido, agendamento, pagamento, revisões do carrinho.
5. Testar pesquisa de satisfação após pedido de teste autorizado; verificar timeout e reenvio sem duplicidade.
6. Impressão térmica: calibrar 58 mm, selecionar via Cozinha e Completa; conferir fisicamente alinhamento.
7. Não ativar impressão automática até confirmação de modelo/driver USB.
8. Confirmar integração com Entregas no projeto separado, nunca publicar arquivos locais excluídos sem revisão.
