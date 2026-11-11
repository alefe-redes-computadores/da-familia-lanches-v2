# DFL Site R58 — Busca resiliente, feedback de funcionamento e avisos certificados

## Origem e segurança
- Cirurgia seletiva sobre R56 e R57 previamente aprovadas. Não altera checkout, API de pedidos, descontos, Firestore, Supabase, mensageria ou lançamento Android.
- A busca de ferramentas do Admin continua local e sem I/O. Corrige erros comuns de digitação (ex.: `cadim`, `cadom`, `horaro`) com sinônimos e distância limitada; ranqueia sem falsos positivos para termos muito curtos.
- O feedback da agenda deixa de usar toast fixo dentro do componente e usa o provedor global existente (sem salvar duas vezes). O salvamento continua aguardando `setDoc` com sucesso.
- Preferências do Admin: silencio apenas de AUDIO/VIBRAÇÃO locais entre 23:00–07:00 no fuso America/Sao_Paulo; prévia discreta em avisos locais. Push remoto e Mensageria 360 INTACTOS, sem promessa de silenciamento da entrega remota.
- Aviso de APK: opt-in persistente somente neste aparelho via `localStorage`, detecta exclusivamente Releases certificadas da API R56, uma vez por build, no primeiro plano. Nunca diz que o APK instalado esta atrasado, porque a TWA web nao le `versionCode`. Para comparar versões reais, abrir a Activity nativa R57.
- Não cria serviço em segundo plano, push de novas versões, permissão Android, WhatsApp ou e-mail. Sem opt-in o observador faz ZERO requisições de atualização.

## Aceite e limites
- Verificar no Admin: `cadim`, `cadom`, `horaro`, `lanche` e `catálogo`; o CTA direciona para o catálogo/horários, nao produtos específicos. Busca pública de lanches usa motor próprio e fica intacta.
- Salvar agenda com sucesso, conferir aviso completo. Falha na rede deve mostrar falha, nunca 'salvo'.
- Central de Notificações: alternar silêncio/privacidade, fechar, reabrir, testar horários, confirmar push independente.
- Central de Atualizações: optar por avisos, fechar e retomar app; somente APÓS UMA NOVA Release certificada, mostrar aviso uma vez. Nova versão web/commit não é nova release Android. Em erro/offline, não anunciar.
- R57 depende de APK compilado na GitHub Actions e instalado no aparelho. R58 não substitui testes Android no dispositivo, nem habilita Releases sem autorização.


## FIX2 — aceite ESLint

- `AdminQuickSwitcher`: reset no requestAnimationFrame, cancelado na limpeza do efeito.
- `AdminNotificationCenter`: refresh inicial adiado a requestAnimationFrame, Link interno Next.js e `useMemo` com dependências corretas.
- `useAdminOrders`: usuário `User | null` em vez de `any`, variável morta removida.
- `StoreOperationAdmin`: import não usado removido, mantendo a gravação Firestore e o toast global.
- `AndroidUpdatesCenter`: dependência `app` explícita na sincronização.
- ESLint priorizado antes das suites para rollback rápido em falha, sem desligar regras.
- Publicação continua seletiva, após validação local, sem alteração de R56/R57.
