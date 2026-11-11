# DFL Site R59 — Home | card compacto de acompanhamento

## Decisão de produto
A proposta aprovada em Design é um cartão pequeno e editorial; não há imagem nova, banner grande nem modal automático. A campanha comercial, ofertas e categorias continuam como estão.

- Posicionamento: depois das ofertas em destaque e do estado da loja, antes dos produtos do catálogo.
- Visibilidade: somente na Home sem filtros de pesquisa/categoria; não ocupa a busca.
- Comunicação: fases básicas em Meus pedidos; link privado e WhatsApp aparecem como recursos condicionais, nunca como benefício automático ou universal.
- `Como funciona`: disclosure `<details>` nativo; o botão `Ver meus pedidos` só abre o modal após toque humano.
- Sem emissão de token, localização, novo fetch, leitura Firestore, alteração de serviços ou de autorização. Nenhuma mudança em Mensageria 360/Finance.

## Testes manuais
- Mobile 320px, 360px, 390px: sem overflow horizontal; card com altura natural e texto legível.
- Desktop 1280px: bloco compacto, sem alargar o texto.
- Abrir/fechar `Como funciona`, teclado Enter/Espaço, foco visível, reduzir movimento.
- Buscar um lanche e selecionar categorias: card se retira para não competir com resultados.
- Verificar banner existente, ofertas, fechamento/agendamento e abertura da tela Meus pedidos.
- Confirmar que a mensagem não promete WhatsApp quando consentimento/rollout estão OFF.

## Pré-requisito
HEAD descendente de `5db0cdc75cbbf2ab19bd310722fe1561d74d784f`; `src/app/page.tsx` deve ser exatamente o blob auditado. Se outro chat tiver alterado a Home, bloquear e reavaliar. Não inclui deploy, pedido real nem alteração de flags.
