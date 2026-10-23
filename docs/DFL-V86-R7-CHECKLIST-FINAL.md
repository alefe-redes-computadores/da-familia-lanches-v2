# DFL SITE V86 R7 — Fechamento e roteiro de publicação

**Status:** cirurgia de código local, não equivale a publicação. Nenhum commit, push, deploy nem alteração direta no Firebase/VPS. A integração externa fica para a etapa seguinte.

## Evoluções adotadas a partir das plataformas do setor

- **Toast (Menu Manager):** revisão antes de publicar, organização com busca, edição focada, e possibilidade de conferir visibilidade do menu.
- **iFood Portal do Parceiro:** diferenciar operação, vendas, visibilidade e qualidade do cardápio.
- **DoorDash Merchant:** fotos devem representar o item/quantidade real; conferir descrição e composição antes de oferecer.
- **Square:** pausar/reativar sem destruir o cadastro e preservar uma única fonte de verdade para adicionais.

Nenhuma referência obriga a copiar preços, regras, conteúdo ou design de terceiros.

## Verificações do PWA do cliente (executar manualmente)

1. Site abre com catálogo e imagens sem atraso excessivo em 4G e Wi-Fi, com e sem login.
2. Busca, categorias, produto individual, compartilhamento, adicionais e grupos em tela compacta.
3. Carrinho existente preservado durante revisão, indisponibilidade e retorno da conexão.
4. Produto com grupo obrigatório não entra no carrinho sem seleção; servidor rejeita requisição adulterada.
5. Checkout com endereço completo, bairro normalizado, taxa certa, cupom inválido e recuperação de conexão.
6. Agendamento em loja fechada, pagamento, WhatsApp e limpeza do carrinho **apenas após confirmação**.
7. Acompanhamento Google e convidado, inclusive recusa de acesso não autorizado e atualização apenas em tela visível.
8. Recompra com itens pausados, ofertas Turbine e prevenção de preço não autorizado.

## Verificações do Admin (executar manualmente)

1. Abrir/fechar/automático, exceções e horários, salvando só quando confirma.
2. Fila de pedidos, aviso de novos pedidos, cancelamento por motivo, cozinha, expedição, Histórico e Gestão.
3. Editor de produto (nome, foto, preço, descrição, categoria, adicionais, grupos, combo, Turbine); conferir retorno após salvar e ao cancelar.
4. Ordenação de categorias/produtos: prévia, confirmação, restauração de posição; sem gravação por cada toque.
5. Pausar/reativar vários itens, conferir combos dependentes; lote com dado desatualizado não pode salvar parcialmente.
6. **Central de Prontidão**: filtrar alertas, tocar em “Revisar produto”, conferir score apenas orientativo, copiar relatório.
7. Checar legibilidade, safe area, foco de teclado, retorno de navegação e modais no Android.
8. Sem aumento significativo de leituras Firestore em repouso; validar contra console Firebase/Vercel na operação real.

## Limitações explícitas da R7

- Nota do catálogo é heurística; não mede vendas, conversão, popularidade nem demonstração de prontidão em produção.
- Alertas utilizam somente o catálogo **já carregado**; quando o Site está em fallback, são informativos e não garantem estado da nuvem.
- Não altera horários nem faz pausa automática; o operador decide o que corrigir.
- Não é teste de segurança completo de Firestore Rules ou deploy; requer conferência separada.
- Não prometer mensagem de motoboy ou sincronização funcional antes de concluir a etapa da VPS.

## Etapa seguinte: integração Site ↔ Entregas ↔ VPS/bot

Preservar `docs/DFL-VPS-WHATSAPP-PENDENCIAS-V86.md` (criado na R6). Casos prioritários:

- Primeira entrega da rota: mensagem correta de primeira parada; sem “anterior” inexistente.
- Próxima entrega: após conclusão da parada anterior, não dizer que ainda está finalizando.
- Despacho pelo Site deve disparar o evento de logística sem sincronizar manualmente.
- Despacho pelo app Entregas deve disparar o aviso mesmo sem o status “Pronto” no Site; validar evento real.

Separar Site (pedido), Entregas (logística) e VPS (WhatsApp). Idempotência, retries, rastreio e autenticação antes de qualquer push ao bot.
