# DFL SITE V87 R1 — Global Premium Experience & Performance

## Escopo entregue nesta etapa
- Home: indexação das categorias e agrupamento/ordenação única de produtos por atualização.
- Home: promoção continua oculta na grade principal somente na condição anterior.
- Home: imagem requisitada em tamanho mais apropriado para card mobile compacto.
- Home: hover premium discreto em dispositivos com mouse fino; foco acessível e reduced-motion.
- Home: ajuste mínimo de ritmo vertical mobile, sem modificar a ordem das seções.
- Admin: corrigida chave de diagnóstico do push (v20 consultada vs v82 gravada).
- Admin: eliminado timer de atualização de 1,5s na central, com atualização ao foco,
  visibilidade, preferências e confirmação real da sincronização.
- Admin: melhorias de foco e dimensão dos controles de notificações.

## O que esta etapa NÃO resolve sozinha
- Latência do FCM, Doze/restrições de bateria Android, entrega server-side de push.
- Integração efetiva com a VPS/WhatsApp, endereço do ingest, estado de fila e cron.
- Cobertura completa de catálogo, checkout, endereços e Admin em dispositivos reais.
- Não foram feitas alterações em Firestore Rules, Supabase, banco, VPS ou deploy.

## Fonte de comparação consultada
- iFood: grupos de complementos e regras de seleção.
- Uber Eats: categorias, foto, modificadores e disponibilidade.
- Square for Restaurants: modifier sets, opções obrigatórias.
- Toast: hierarquia e visibilidade, busca no cardápio online.
- DoorDash: disponibilidade de modificadores associados ao item.
- web.dev: transform/opacity, reduced-motion e responsividade INP.

## Testes manuais recomendados
1. Desktop: hover sem deslocar cards vizinhos; promoções clicáveis por teclado.
2. Android: nenhum hover preso ao toque; busca e categorias sem alteração na ordem/preços.
3. Android Admin: diagnóstico mostra a última sync real; 'Revalidar' atualiza sem contador infinito.
4. Não interpretar último registro de token como confirmação de recebimento do push.
5. Confirmar o push Android real com tela ligada, em segundo plano, bateria otimizada e 4G.

## Release
Script apenas local, com backup, rollback e testes; sem build local, commit ou push.
