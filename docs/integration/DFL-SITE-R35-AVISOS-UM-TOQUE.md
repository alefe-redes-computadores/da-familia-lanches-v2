# DFL SITE R35 — confirmação em um toque com consentimento separado

## Problema verificado em 08/11/2026
- Um pedido real foi registrado e reconhecido pelo Entregas, mas não entrou na fila WhatsApp do Supabase.
- Vercel registrou `intent_not_claimable`, que é **genérico** e não prova sozinho a causa.
- No checkout anterior, a autorização era um checkbox opcional, desmarcado por padrão e visualmente discreto. Informar o telefone **não** era consentir.
- O motivo definitivo do pedido específico depende do registro Firestore, consultável em Admin → Central de Mensageria (R32/R34); não retroagir envios por suposição.

## Implementação R35
- A confirmação no passo Pagamento tem duas ações igualmente explícitas e acessíveis, ambas **de um toque**:
  1. `Confirmar pedido + receber avisos`: a ação afirmativa define `whatsappNotificationsConsent=true` **somente para esse pedido**;
  2. `Confirmar pedido sem avisos no WhatsApp`: define `false`, sem prejudicar a compra.
- Não existe checkbox pré-marcado, consentimento inferido pelo telefone, reutilização do rascunho ou inscrição em promoções.
- O Site mantém o histórico/andamento do pedido mesmo sem notificações de WhatsApp.
- Servidor R12 continua exigindo valor `true` explícito, carimbo e fonte de consentimento; R11 e R24 continuam barrando mensagens sem autorização ou obsoletas.
- Fluxos convidados e Google usam a mesma escolha. Carrinho, entrega/retirada, preços, pagamentos, PIX, fallback WhatsApp, idempotência e rollback preservados.
- Nenhum pedido existente é alterado; não há reenvio de avisos anteriores.

## Critérios de aceite
- Conferir ambos os botões no PWA/APK em viewport móvel, com foco acessível, sem rolamento truncado.
- Finalizar compra canário autorizando: Firestore registra `whatsappNotificationsConsent:true`, timestamp/fonte e mensagem só envia se R11 permitir.
- Finalizar compra sem avisos: registra false e nenhuma mensagem inicia.
- Verificar Admin R34 com ID e Supabase, quando houver consentimento, sem assumir que `queued` significa entrega real.
- Confirmar que pedidos Site e Entregas continuam sendo materializados uma única vez, sem replay.

## Atenção de política
Política WhatsApp Business de 23/09/2026 exige número e opt-in do destinatário antes de contatá-lo. O botão de confirmação com avisos é uma manifestação afirmativa; a confirmação sem avisos permanece disponível. Não usar opt-in automático por padrão ou checkbox pré-marcado.
