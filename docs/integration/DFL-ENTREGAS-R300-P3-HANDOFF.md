# Handoff Entregas — R33 Site / Supabase

Enviar ao chat Entregas quando a R33 Site estiver validada.

**Importante:** Entregas R300 P1/P2 é a autoridade sobre paradas físicas, cadastro e prontidão. Não mexer em seus commits. Site R33 só prepara o receptor de retirada e Supabase; eventos OFF.

**Next-stop:** manter contrato R300 P2 acordado, `manual-msg-v2__delivery.next_stop__{delivery_id}__{transition_key}`. `transition_key` SHA-256 por transição persistida. `previous_stop_completed_at` = `occurred_at`. Somente avançar após concluir TODOS os pedidos da parada física; não emitir via reordenação, retomada, rota inativa ou sem consentimento.

**Pickup manual (contrato novo para implementar no Entregas):**
1. Se `fulfillment_mode=pickup`, `origin=loja/manual`, identidade `dfl-*`, cadastro novo e opt-in duplo confirmado, gerar **order.created** v2 assinado, com `event_id=manual-msg-v2__order.created__{delivery_id}__{sha256}` e `payload.manual_pickup_v1=true`, `payload.created_at=occurred_at`, `payload.fulfillment_mode=pickup`.
2. Botão `Pronto para retirada` para pedido manual elegível, separado de `Concluir retirada`; persistir `pickup_ready_at` com marcação atômica/idempotente e só depois produzir **order.ready** v2 com `payload.pickup_ready_at=occurred_at` e ID de evento único e estável. Não mudar autoridade do Site para pedidos `dfl_site`.
3. Reaproveitar telefone e consentimento já obtidos; NÃO habilitar manual pickup pelo simples telefone cadastrado; excluir testes internos, cancelados, concluídos, retirada finalizada, pedido sem autorização ou ocorrência antiga. Sem número comercial, exibir rótulo humano seguro, não UUID como número.
4. Enviar v2 pelo endpoint manual Site existente; HMAC atual no formato `timestamp.body`. Preservar o evento em retries, sem outro ID após timeout incerto.
5. Flags novas OFF no Entregas; coordenar com as flags Site / Supabase somente durante homologação em número autorizado.

**Campos obrigatórios:** `source=manual`, `event_type=order.created | order.ready`, `order_id=entregas:{delivery_id}`, `event_id=manual-msg-v2__{event_type}__{delivery_id}__{transition_key}`, `occurred_at` ISO UTC, `payload.delivery_id`, `payload.fulfillment_mode=pickup`, `payload.manual_pickup_v1=true`, `payload.manual_messaging_opt_in_v1=true`, `payload.notify_whatsapp=true`, `payload.transition_key` SHA256 lowercase, para cadastro `payload.created_at=occurred_at`, para prontidão `payload.pickup_ready_at=occurred_at`.

**Testes coordenados:** cadastro/retirada/baixa, canário restrito, sem consentimento, telefone inválido, duplicidade, dois dispositivos, offline e replay, mudança de modalidade, terminal, novo pedido com mesmo cliente, seis paradas com agrupamento físico. Nenhum teste hermético deverá enviar WhatsApp.

Obs. Site R32 já publicada; R33 só após validação de gates globais Termux. Não ativar variáveis em produção pela existência deste handoff.
