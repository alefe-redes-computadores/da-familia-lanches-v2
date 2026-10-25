# V88 R2 — Proteção do rascunho
- Validação de versão, timestamp, horário futuro, tamanho de payload e tipos dos campos.
- Rascunho inválido deixa de bloquear o checkout: é descartado do armazenamento local.
- Migração convidado → conta autenticada não sobrescreve rascunho válido existente.
- Nenhuma alteração de backend, preços, regras comerciais ou tentativa idempotente.
- QA: checkout interrompido, login após rascunho, armazenamento corrompido, restauração válida.
