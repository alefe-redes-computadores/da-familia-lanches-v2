# DFL Integration V1 — lado DFL Site

## Papel do sistema

O DFL Site é a autoridade do pedido comercial.

Ele não escreve diretamente nas coleções internas do DFL Entregas.
A comunicação futura será feita por eventos persistidos em outbox e transportados por API/VPS.

## Compatibilidade com DFL Entregas V19A

Contrato alinhado ao commit do DFL Entregas:

`e8be3f09e6a31d798ba07362f87a358ab6354a03`

Schema de integração:

`schema_version = 1`

Source do Site:

`source_system = "dfl_site"`

Coleção de saída:

`integration_outbox`

## Event ID

Formato compartilhado:

`evt-v1__<event_type>__<entity_id>__<occurrence_id>`

Cada parte variável é codificada com `encodeURIComponent`.

Retry deve reutilizar o mesmo `event_id`.

### order.created

- `entity_type`: `order`
- `entity_id`: ID de `Pedidos/{id}`
- `occurrence_id`: `created`
- criado na mesma Firestore transaction do pedido.

### order.updated

- `entity_type`: `order`
- `entity_id`: ID de `Pedidos/{id}`
- `occurrence_id`: timestamp persistido da mudança de status
- criado na mesma Firestore transaction da mudança comercial.

## Payload produzido pelo Site

O Site preserva os nomes do seu contrato comercial V2 dentro do payload V1:

- `orderId`
- `sourceSystem`
- `orderSchemaVersion`
- `userId`
- `customerSnapshot`
- `tipoEntrega`
- `deliverySnapshot`
- `itens`
- `subtotal`
- `taxaEntrega`
- `desconto`
- `cupom`
- `rewardId`
- `total`
- `metodoPagamento`
- `trocoPara`
- `status`
- `isAgendamento`
- `statusUpdatedAt`

Esse payload é um snapshot de integração, não o documento Firestore inteiro.

Campos internos como `data` e objetos Timestamp/FieldValue não são transportados.

## Atomicidade

Pedido/recompensa/outbox e mudança de status/recompensa/outbox ficam dentro da mesma Firestore transaction.

Não existe transporte para o DFL Entregas nesta etapa.

## Fora da V19A

Ainda não existe:

- VPS/API;
- relay da outbox;
- consumo no DFL Entregas;
- inbox no Site em runtime;
- retorno logístico;
- ETA;
- posição de rota;
- WhatsApp por evento.

As coleções `integration_inbox` e `integration_external_identities` ficam reservadas no contrato compartilhado, mas não recebem runtime do Site nesta etapa.
