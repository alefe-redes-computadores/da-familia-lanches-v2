# DFL Site V85.1 R7 — Fechamento global antes da publicacao

**Estado:** pacote local sem commit, push, deploy e sem configuracao de hardware.

## Melhorias de seguranca operacional

1. Calendario **padrao** passa a fechar segunda, terca e quarta. Isto e somente o fallback quando o documento `settings/loja` estiver inexistente, incompleto ou sem uma configuracao daquele dia: valores explicitamente salvos no Firestore **continuam prevalecendo**, inclusive abertura manual. Nao altera nenhum documento do Firebase.
2. Endereco canonico prioriza cada campo nao vazio de `deliverySnapshot`, depois `addressSnapshot`, depois campo legado; bairro isolado nao esconde endereco completo antigo. Afeta apresentacao do Admin e ticket de expedicao, **nao edita pedidos**.
3. Um pedido de convidado memorizado neste navegador nao aparece misturado ao painel de uma conta Google autenticada. Nao apaga o historico do convidado.

## Auditoria de fechamento (somente leitura)

- Checkout: chave de idempotencia e autoridade comercial preservadas.
- Admin: listener unico, R1/R2 de resiliencia e R3 de busca/foco.
- Site: busca global, card acessivel, R4 de carrinho e revisao.
- Eventos: outbox Site / relay com retry, sem segunda copia de pedido.
- Impressao: R4-R6 58/80 mm, calibracao USB generica, vias Preparo/Completa. **Nao imprime sem acao manual.**
- Nenhuma alteracao dos contratos locais `src/lib/integration/contracts.ts` e `src/lib/integration/server/reversePersistence.ts`.

## QA manual obrigatorio antes de autorizar push

1. Abrir Home publica no Android, escolher categoria, pesquisar item de outra categoria e verificar busca global.
2. Abrir produto, personalizar combo, adicionar ao carrinho e conferir revisao sem concluir pedido de teste em producao.
3. Entrar no Admin, alternar Cozinha/Agendados/Expedicao/Historico/Gestao. Abrir Gestao e testar Funcionamento, Catalogo, Frete, Cupons, Fidelidade e Saude.
4. Abrir um pedido existente e verificar endereco com complemento, observacoes, pagamento, status, impressao manual e botao Entregas. Nao cancelar nem mudar status de pedido real apenas para QA.
5. Se possivel, conferir no notebook as vias Cozinha/Completa com pre-visualizacao 58 mm, sem ativar impressao automatica.
6. Conferir horario real salvo no painel. **O fallback fechado segunda-quarta nao modifica a agenda persistida no Firestore.**
7. Testar operacao Site↔Entregas em ambiente controlado, especialmente cancelamento e saida de rota; sem produzir duplicidade de entrega.

## Publicacao futura

- Publicar somente apos autorizacao do responsavel; preparar commit seletivo, nunca `git add .`.
- Verificar diff antes, especialmente os dois arquivos locais antigos de integracao, nao tocar neles sem revisao.
- `node node_modules/typescript/bin/tsc --noEmit` no Termux; **nao rodar build no Android**.
- Apos deployment Vercel READY, testar o Admin na producao; READY nao substitui QA real.
- Release gate estatico nao comprova disponibilidade do Firebase, acesso a impressora USB ou eventos reais do DFL Entregas.

## Impressao automatica USB — etapa seguinte

Diagnosticar modelo e driver no notebook; teste fisico de 58 mm; se ESC/POS compativel, considerar um agente local com fila autenticada e idempotencia por `(origem, order_id, tipo_via, revisao)`, politica de reimpressao e limite de tentativas. Fontes iFood/99Food somente por canais oficialmente autorizados. Nunca emitir comandos de corte ou impressao silenciosa sem configurar o driver e testar a bobina.
