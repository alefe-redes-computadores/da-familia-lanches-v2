# DFL SITE R233 — experiência real de bairro: Quebec → Jardim Quebec

## Evidência e problema

Uma cliente digitou **Quebec**, procurou atendimento no WhatsApp para identificar o bairro e posteriormente conseguiu finalizar a compra. Isso NÃO prova, por si só, que a compra falhou. A captura demonstra uma **fricção de compreensão**: o nome parcial não indicava claramente a opção oficial **Jardim Quebec**. O município, a disponibilidade comercial e a taxa de entrega continuam dependentes da tabela configurada pela loja.

## Correção

1. A pesquisa continua privilegiando a tabela de bairros configurada pelo administrador. Se **não houver nenhum resultado** nessa tabela, consulta a lista de referência local sem requisitar API nem criar bairro.
2. O seletor avisa explicitamente quando uma sugestão veio apenas da lista de referência. **Sugerir um nome não é prometer cobertura ou frete.** O cliente sempre precisa tocar na opção.
3. `inspectDistrict('Quebec')` passa a exigir a confirmação do bairro completo quando há candidato como **Jardim Quebec**. A política se aplica tanto ao frontend quanto à validação do backend já existente; a taxa permanece apenas por igualdade normalizada.
4. Campo com dica simples, letras legíveis no Android, botões de pelo menos 44 px e texto de ajuda mais claro.
5. Regressão sintética R233 acrescentada ao GitHub Actions de Proteção Crítica de Vendas. Sem pedido real nem gravação no banco.

## Casos protegidos

- `Quebec` sugere `Jardim Quebec` e não calcula taxa por aproximação.
- `Jardim Quebec` continua válido como nome completo; só recebe taxa se constar da tabela.
- Se a tabela contém `Jardim Quebec`, ela é a fonte prioritária.
- Se a tabela não o contém, é apenas nome de referência: não afirmar região atendida.
- Erros ou nomes inexistentes não geram endereço ou preço falso.
- Recompra, rascunhos, chave de idempotência, checkout e relatórios operacionais intactos.

## Homologação manual segura

Abra o checkout, digite **Quebec**, veja a sugestão **Jardim Quebec**, selecione-a e confirme a prévia e o texto de entrega. Repita com um bairro que conste da tabela e outro que não conste. Não conclua pedidos de teste. Dados reais de clientes da captura não integram nenhuma fixture.

## Publicação

Backup antes de escrever. Exige HEAD R232-R2 `fac3a63a7a06f571fc532098010cd0d67f434f72`, branch main, nenhum diff rastreado ou stage anterior. Commit e push seletivos somente após testes. Sem build local, sem mudança de regras Firebase/assinatura Android.
