# DFL SITE R234 — Fechamento Premium de Endereços

**Base certificada:** `21901386e3682789659f5a0caf997bed7d673a7e` (R233-R3). **Branch:** `main`.

## Motivação: pedidos reais, sem usar pedidos de teste

Uma cliente pesquisou **Quebec** e precisou de orientação; no mesmo fluxo apareceu a rua abreviada **Deze**. A R233-R3 protegeu essa ocorrência; a R234 estende a experiência para **todos os bairros compostos** e telas pequenas.

## O que muda

1. **Descoberta abrangente e local:** procurar `Jardim`, `América`, `São José`, `Nossa Senhora`, `Coração`, `Graças`, `Quebec`, entre outras partes do nome, sem chamada extra de rede.
2. **Resultados da tabela + referência:** antes, uma correspondência na tabela da loja ocultava outras opções conhecidas da cidade. Agora o seletor compõe as duas fontes, remove duplicatas e prioriza bairros registrados na tabela.
3. **Proveniência por sugestão:** cada opção indica `Na tabela da loja · taxa a confirmar` ou `Nome da cidade · entrega a confirmar`. Uma referência não prova atendimento, nem habilita taxa, nem insere preço.
4. **Sem adivinhação:** texto parcial não vira bairro confirmado; escolha por toque preenche o nome completo. A validação `inspectDistrict()` preserva todos os nomes exatos, inclusive `Planalto` e `Novo Planalto`.
5. **Android/mobile:** lista com altura relativa à janela visível (dvh), rolagem interna, alvos de toque de pelo menos 48 px e layout compacto. Suporte a movimento reduzido.
6. **Endereços salvos:** nome completo de referência não fica abrindo uma lista intrusiva sem necessidade, mas mantém aviso de que a taxa depende de verificação.
7. **Mensagem educativa:** o campo de bairro exemplifica Quebec, América, São José e Nossa Senhora.

## O que não muda

- Nenhum pedido existente, carrinho, endereço salvo, tabela de frete ou configuração Firebase é regravado.
- Nenhuma taxa é inferida por substring. **Só o cálculo comercial autoritativo existente determina o preço**.
- `searchDistrictCatalog()` permanece idêntico para consumidores antigos. Novo método é `searchDistrictCatalogComplete()`, usado somente no picker.
- API de pedidos, idempotência, outbox Entregas, WhatsApp, geocodificação, assinatura APK e Admin não são alterados.
- `streetNeedsClarification()` e a proteção `Rua Deze` / `Rua Dezesseis` da R233-R3 permanecem intactas.

## Implementação e testes

- 6 arquivos rastreados alterados, 2 novos (teste + relatório).
- 60 verificações funcionais R234 em simulação local, incluindo o matcher real reconstruído para conferir a lógica; conjunto completo validado pelo instalador em `~/projects/da-familia-lanches-v2`.
- O teste `scripts/test-site-r234-compound-districts.cjs` é chamado por `scripts/test-site-r233-quebec.cjs`, que já participa da Action **Proteção Crítica de Vendas**. Nenhuma mudança no workflow Android é necessária.
- Installer R234: exige HEAD, main, working tree limpa, stage vazio, integridade do ZIP, âncoras, backup completo dos originais, testes e typecheck, commit/push seletivos com rollback até a criação do commit.

## Homologação manual (sem enviar pedidos de teste)

No checkout do site, abrir novo endereço: digitar `Jardim` e conferir **várias opções**, primeiro as existentes na tabela e depois opções marcadas apenas como referência. Digitar `Quebec`, `América`, `São José`, `Nossa Senhora` e `Graças`; tocar em uma sugestão e verificar o nome completo no resumo. Checar que a taxa só aparece pela tabela da loja, nunca pela busca. Digitar `Rua Deze` e conferir bloqueio/assistência, depois `Rua Dezesseis` e confirmar nome preservado. Testar teclado Android aberto e rolagem interna, sem finalizar nenhum pedido fictício.

**Importante:** validar no GitHub se a Action de vendas ficou verde após o push; o instalador valida os testes locais e não afirma que a implantação já terminou.
