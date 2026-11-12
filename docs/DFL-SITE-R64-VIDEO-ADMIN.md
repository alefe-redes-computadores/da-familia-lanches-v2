# DFL SITE R64 — Acabamento do Admin orientado pelo vídeo

Base obrigatória: Site R63 `6ff75724b12abc545d1fe0fb896e4d3a8cce0b59`, production Vercel READY verificada em 12/11/2026.

## Achados objetivos no vídeo fornecido (96 s, gravação 12:00)
- Em Gestão (Loja, Mensageria, Campanhas, Entrega, Cardápio, Saúde) a grade com 11 ferramentas é repetida antes de cada conteúdo. A navegação ocupa o topo da tela, causando rolagem longa.
- O título externo frequentemente repete o título do painel interno (mensageria, campanhas, loja).
- Em Entrega / Bairros, os nomes ficam truncados em coluna muito estreita, apesar da área útil estar disponível. CSS de `rateView span` conflita com CSS grid responsivo.
- Mensageria: 70 "na fila" e 10 suprimidas na gravação; isso é indicador, não prova de entrega nem bug de backend. Sem mudança em filas, reenvio, status, provider ou controles.
- No catálogo, os filtros, revisão e gerenciador estão operacionais; não alterar operações nem composição de pedidos.

## Solução
- Barra compacta "Gestão da loja / [seção]" e botão "Trocar ferramenta", que revela grade acessível, recolhe após escolha e mantém atalho de notificações.
- Remove apenas título externo redundante nas áreas de gestão; os títulos internos e cartões continuam visíveis.
- Corrige por área explícita a distribuição nome/valor/ícone na lista dos bairros, preservando edição e publicação sob clique.
- Ajusta densidade visual do topo da Central de Mensageria sem suprimir avisos de segurança ou fila.

## Não alterar
Checkout, PIX, preços, frete, agendamento, pedidos, rastreamento, consentimentos, chaves, Firestore, Supabase, mensageria, bot Finance ou Evolution. Sem build pesado, sem commit ou deploy pelo instalador. Gates com rollback seletivo. O vídeo antecede a publicação R63; as mudanças foram cruzadas com os componentes atuais da R63.

## FIX1 — Compatibilidade do gate R37
O CSS da R63 contém uma regra antiga com `display:none!important` no menu
redundante da área operacional desktop. O contrato R37 bloqueia qualquer regra
com `display:none!important` após seu marcador, mesmo nesse caso legítimo.
O FIX1 remove só o `!important` dessa regra, preservando `display:none` e o
contrato R63 de uma única navegação no desktop. O teste R37 continua obrigatório,
sem alterações. Checkout, valores, notificações e Firestore permanecem intocados.
