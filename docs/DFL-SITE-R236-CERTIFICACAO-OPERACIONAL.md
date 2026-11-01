# DFL SITE R236 — Certificação Operacional e Conversão (01/11/2026)

**Base esperada:** `b58e60a16c7c492333ce69c84538a8f486a3dd74` (R235). **Escopo:** somente teste de regressão, documentação e integração ao gate GitHub Actions de vendas. **Sem alterações** em checkout, preços, produtos, catálogo, campanhas, agendamento, CSS, Firestore ou integração Entregas.

## Achados confirmados

1. **Offline:** na R235 a Home e o checkout usam estado inicial compatível com renderização do servidor (`useState(true)`), depois sincronizam `navigator.onLine` ao montar e em eventos de reconexão/retomada. O aviso da Home está dentro de `!isOnline && ...`. A mera existência da frase em extração de HTML **não comprova** que o aviso foi exibido ao cliente conectado. Sem prova de bug ativo, nenhuma alteração.
2. **Black Friday:** o rótulo neutro `OFERTA` é fallback deliberado da vitrine; a campanha visual é carregada no navegador por `/api/public/visual-campaigns` a partir da configuração remota. Há preset Black Friday no código, mas isso **não confirma** sua ativação no Admin de produção. A captura textual pública mostra duas das seis ofertas no preview e três promoções regulares, quatro combos (pode variar por catálogo/sessão). Não trocar marca, cores, preços ou etiquetas por causa de extração textual.
3. **Loja 02/11:** a **segunda-feira 02/11/2026 está desabilitada na agenda padrão**. A operação extraordinária só funciona se houver regra publicada para `2026-11-02` com horários reais ou abertura manual; `force_closed` tem prioridade. **Nenhuma regra foi aplicada no Admin.** O teste executa o motor real offline com exceção sintética e valida agendamento compatível.
4. **Combo 7 Uai:** hoje não há estrutura de adicionais ou remoções **por lanche interno**; o contrato existente é um vetor de extras por linha de combo. O cliente já foi informado disso pela R235. O preço segue `(preço do combo + soma dos adicionais por combo) × quantidade de combos`. Sem confirmação comercial sobre precificação por unidade, não alterar essa autoridade nem criar a escolha individual de fachada.
5. **Mobile:** o shell da R235 reserva altura de navegação e safe area, o modal rola independentemente, e o carrossel mantém a configuração visual existente. Testes de CSS detectam regressões de estrutura, **não garantem visualmente** todos os tamanhos de tela ou teclado: exige sessão real de homologação.
6. **Checkout:** status informativo pode usar cache; confirmação exige leitura remota mais recente e o servidor valida novamente dentro da transação. Idempotência, guardas de preço e recuperação de tentativa incerta preservadas.

## Plano de homologação física (sem gerar pedidos em produção)

- Android/PWA, 320px/360px/412px e teclado visível: chegar ao último produto, rolar carrossel completo, usar botão de comprar/fechar e fechar modal; testar retorno do segundo plano.
- Online e offline: abrir com internet, ver se o aviso fica ausente; desativar internet, ver se aviso aparece e botão de confirmação fica bloqueado; reativar e verificar desaparecimento sem recarregar. Não clicar para finalizar.
- Black Friday: sessão normal e anônima; observar selo/banner e comparar Admin > Campanhas Visuais, sem editar. O fallback `OFERTA` não representa falha isoladamente.
- Combo 7 Uai: conferir descrição de escopo, quantidade 1 e 2 combos, adicionar/remover extras e detalhar observação; confirmar total e conteúdo do carrinho, sem efetivar compra. Não prometer escolha por lanche individual.
- Segunda-feira 02/11: checar no Admin > Funcionamento/Agenda se há **exceção publicada**, horário e modo atual. Confirmar Home e disponibilidade de agendamento. A equipe decide abrir; não criar exceção automaticamente.

## Evolução futura (requer decisão comercial)

Para implementar personalização real por unidade dentro do combo, será necessário definir: se extra é cobrado por lanche, por ocorrência ou por combo; limites individuais e regras obrigatórias; representação de removidos; identidade do componente por índice; precificação assinada/validada pela API; persistência e impressão; integração Entregas com instruções legíveis para cozinha; migração de carrinho e re-pedido legado; testes de dupla quantidade e idempotência. Não introduzir esse recurso durante operação de feriado sem essas regras.

## Entrega da R236

- Adiciona `scripts/test-site-r236-operational-final.cjs` ao repositório, exercitando motores reais de funcionamento, agendamento e campanha em memória, além de contratos offline/mobile/combo/checkout.
- Liga o script na GitHub Action `DFL SITE - Protecao Critica de Vendas`.
- Adiciona este relatório como documento versionado.
- Instalador guardado por commit base, branch `main`, stage limpo, backup, manifestos SHA-256, escopo seletivo, regressão completa, TypeScript e rollback em falha. Só dá push após sucesso total. **Sem criação de pedido real ou alteração do Firebase.**
