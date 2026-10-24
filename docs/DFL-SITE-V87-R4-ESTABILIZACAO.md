# DFL SITE V87 R4 — Global stabilization

## Resultados da cirurgia
- Estado de loja preserva último retorno remoto em perda temporária de rede; se não houve retorno, usa agenda e revalida após breve cooldown. Não cria novos listeners.
- Catálogo público continua visível durante atualização manual, rejeita payloads incompletos e aplica espera progressiva limitada às recuperações.
- Acompanhamento de convidado interrompe seu polling enquanto a aba estiver oculta/offline; retoma visível, com POST autenticado por prova privada, no máximo três pedidos e 90s entre consultas.
- Checkout ViaCEP aplica timeout de oito segundos e não sobrescreve endereço se cliente modificou CEP no meio da consulta. Retorno de status acessível.
- Admin catálogo: busca independente de acentos com várias palavras, sem request novo, contagem e disponibilidade consistentes para produtos legados `disponivel === undefined`.
- Admin saúde: diagnóstico sob demanda com timeout de dez segundos e mensagem compreensível, sem polling.
- Admin: falha da seção não fica presa ao navegar para outra seção.
- Polimento de foco e acessibilidade para checkout, catálogo e acompanhamento.

## Deliberadamente preservado
Checkout autoritativo e idempotente, valores, frete, adicionais V86, promoções, todas as operações de produtos em massa, logs/worker/FCM V87 R2, Admin quick switcher R3, menu e CTA.

## Manual QA antes de publicar
1. Fazer pedido com bairro Coração Eucarístico, conferir endereço e frete no Admin.
2. Simular CEP lento e digitar outro CEP antes da primeira resposta (o primeiro não pode sobrescrever o segundo).
3. Abrir e fechar manutenção da loja e alternar offline/online; confirmar estado após recuperar conexão.
4. Abrir histórico de convidado e ocultar a aba; inspecionar contagem de requisições na rede.
5. Admin: buscar `coracao eucaristico` / `frango bitela` e verificar disponibilidade de produto legado.
6. Confirmar ações V86, alertas e checkout no Android real. Testes de CI não substituem QA manual.

## Publicação
Esta cirurgia não executa build local, commit/push, Vercel, Firebase Admin ou VPS.
