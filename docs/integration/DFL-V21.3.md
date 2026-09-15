# DFL V21.3 — Worker resiliente

O relay Site -> Entregas mantém AbortController, mas o timeout padrão passa de
8s para 20s. Isso dá margem para cold start/transação do endpoint sem remover
limite de segurança. O retry/idempotência do outbox permanece inalterado.

A redução principal de custo Firestore está no worker reverso do DFL Entregas.
