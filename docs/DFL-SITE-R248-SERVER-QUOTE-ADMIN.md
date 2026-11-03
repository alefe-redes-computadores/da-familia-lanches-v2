# DFL SITE — R248-R2 | Correção segura e conferência no servidor

## Diagnóstico confirmado
A execução da R248 em 03/11/2026 falhou no teste local com
`R248 forbidden import src/lib/catalog.ts -> @/data/products`.
Isso ocorreu porque o carregador isolado de módulos do arquivo de testes R248
omitira as duas dependências válidas `@/data/products` e `@/data/addons`.
O contrato de catálogo real importa ambos para os dados-base; os testes
simplificados usados na simulação não reproduziam esse detalhe. O rollback
da primeira instalação foi executado antes de publicar.

## Correção R2
- Pré-carregar os mesmos `src/data/products.ts` e `src/data/addons.ts` do projeto.
- Injetar somente esses dois imports explícitos na lista restritiva do carregador.
- Conservar as outras restrições e **não abrir o carregador para imports arbitrários**.
- Validar novamente com um mock que reproduz especificamente ambos os imports reais.
- Reexecutar provas de rollback, instalação, TypeScript e commit seletivo.

## Escopo e segurança
Os **mesmos oito paths da R248**: dois arquivos modificados (laboratório e
CI) e seis arquivos novos (motor, API admin, painel e CSS, teste, documentação).
O backend da prévia é autenticado e apenas leitura. Revalida estoque comercial,
preço e disponibilidade a partir dos registros atuais do servidor. Não autoriza
cobrança ou pedido; não altera checkout, rotas operacionais, impressão ou Firestore.

## Controles do instalador
Exige a `main` no SHA `1cddf83b282567b86f19f9b6f35ecc8274b077b8`,
manifesto com hash SHA-256 de todos os arquivos, staging limpo, diff rastreado
limpo, e que os novos destinos não existam. Backups específicos e rollback
seletivo (não faz `git reset --hard` nem `git add -A`). Antes do push, roda
R248 e regressões R247–R237, contrato de vendas e `tsc --noEmit`.

## Status
Correção submetida a simulação isolada (incluindo imports reais), sem deploy
automático por este chat. Confirmar os logs do instalador e Actions do GitHub.
