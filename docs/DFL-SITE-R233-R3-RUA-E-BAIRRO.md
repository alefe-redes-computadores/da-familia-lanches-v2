# DFL SITE R233-R3 — Bairro Quebec e Rua Dezesseis

## Evidência real e limite do diagnóstico

Uma cliente escreveu "Quebec" ao buscar o bairro e depois um pedido apareceu com rua abreviada, relatada como "Deze". O registro do WhatsApp também apresenta a grafia curta. O caminho Site -> evento de integração transporta `deliverySnapshot.street` sem aplicar um corte para quatro caracteres. Isso aponta para o valor já abreviado antes da integração, mas não prova se foi digitação parcial, escolha em autocomplete ou alguma outra etapa anterior. Os registros privados da cliente não foram consultados nem alterados.

## Correções de baixo risco

- R233 mantida: `Quebec` recomenda `Jardim Quebec`, mas não decide automaticamente nem autoriza cobertura ou taxa.
- Corrige contrato legado R38 preservando exatamente "lista cadastrada" e "a loja confirmará a entrega e a taxa" na explicação de referência.
- Proteção estreita para `Deze`, `Rua Deze`, `Dezes`, `Dezess`, `Dezesse` e `Dezessei`: mostra alerta e exige rua completa antes de finalizar.
- Cliente pode escolher explicitamente **Usar Rua Dezesseis** ou continuar digitando qualquer outro nome verdadeiro. Nunca troca silenciosamente.
- O backend também recusa esses fragmentos com `ADDRESS_INVALID` antes de criar o pedido. Essa regra não corrige nem altera pedidos antigos.
- Sugestões opcionais de ruas ignoram o mesmo fragmento abreviado; a integração e os valores de frete permanecem intocados.
- Ruas legítimas `Rua Dez`, `Rua 16`, `Rua Dezesseis`, `Rua Dezembro`, `Rua Dezenove` continuam permitidas.

## Segurança / rollback

- Somente arquivos na allowlist, backup rastreado em Downloads e rollback seletivo em caso de testes falharem.
- Não usa `git add -A`, não altera segredos, não executa POST de compra nem modifica registros da cliente.
- Só tenta commit/push depois de regressões locais e TypeScript. Se falhar depois do commit, o commit local será preservado.
- A GitHub Action de proteção de vendas inclui os dois novos cenários. Build Android não é necessário para o mecanismo web; o Cliente é TWA e renderiza o site.

## Teste recomendado em homologação

1. Digitar `Quebec`: escolher `Jardim Quebec` explicitamente, sem criar taxa fictícia.
2. Digitar `Deze` na rua: exibir alerta, bloquear continuação e oferecer confirmação de `Rua Dezesseis`.
3. Digitar `Rua Dezesseis` completa: alerta desaparece; revisar resumo antes de finalizar.
4. Conferir sugestão de Geoapify sem aceitar nomes curtos. Não gerar pedidos reais fictícios.
5. Se ainda ocorrer abreviação, comparar `deliverySnapshot.street` no pedido original (com autorização apropriada), payload da outbox do Site e o campo recebido no Entregas. Tratar dados pessoais como sensíveis.

## Correção adicional do teste P0 de vendas (R233-R3)

A suíte real `scripts/test-site-sales-critical-r1.cjs` usa `fakeRequire` estrito e precisa carregar novos módulos de produção explicitamente. Adicionada transpilação do módulo puro `streetNameSafety.ts` para que o mock teste **o código real**, sem afrouxar a validação. Novos cenários reais da função POST, com Firestore apenas em memória:

- `Rua Deze`: resposta `ADDRESS_INVALID`, 0 pedidos/outbox ou jobs extra gravados.
- `Rua Dezesseis`: HTTP 201 no mock, rua preservada integralmente em `deliverySnapshot.street` e `endereco`.

Nenhuma escrita real em Firestore; testes executados pelo instalador e GitHub Actions.
