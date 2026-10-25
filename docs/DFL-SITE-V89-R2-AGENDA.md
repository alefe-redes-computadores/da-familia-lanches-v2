# V89 R2 — Visibilidade de agendamentos vencidos
- Card Agendado recebe aviso quando horário chega, destacado após 15 minutos.
- Não altera automaticamente status, não aciona produção, não dispara alertas, não cria reads.
- A contagem de Atenção permanece consistente: aviso informativo separado, não entra no contador global.
- QA: agendado no futuro, na hora e vencido; concluído/cancelado sem aviso.
