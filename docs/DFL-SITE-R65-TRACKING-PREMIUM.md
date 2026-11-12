# DFL SITE R65 — Acompanhamento Premium + Leitura de bloqueios

## O que muda (somente visual)
- Card informativo da Home com CTA visível, ícones Lucide e microcopy condicional, sem gerar token.
- Meus Pedidos: formulário protegido premium que exige o link completo e deixa claro que número do pedido não concede acesso; parser oficial, same-origin, zero persistência ou logs.
- Fontes, contrastes, estados e botões da listagem de pedidos, agendamento e recompra: premium dark responsivo.
- Pedido recebido e banner de pedido ativo com CTAs legíveis, sem alterar suas ações.
- Corrige ícone vazio genérico.

## O que não muda
- Tracking automático R23/R25/R27, anti-replay, idempotência, checkout, PIX, Admin e Entregas, regras de permissão, WhatsApp, consentimento, segredos, Firestore e Supabase.
- Não envia link, não reenfileira nem reprocessa revisão incerta. Revisão humana continua obrigatória.

## Diagnóstico separado
`node DIAGNOSTICAR-LINKS.cjs` consulta, sem alterar, resumos de estados e motivos das três filas do Site e duas do Entregas, usando autenticação existente do Firebase CLI. Nenhum ID, telefone, token ou link é impresso.

## Segurança operacional
- Instalador exige origem atualizada e árvore rastreada limpa, confere blobs originais antes de alterar e cria backup por caminho.
- Rollback seletivo de paths tocados se qualquer teste falhar.
- Sem build pesado, sem push automático e sem git add -A.
- Publicador exige aceite local e push de 10 caminhos autorizados somente.
