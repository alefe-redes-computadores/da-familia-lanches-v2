# DFL SITE R229 — operação: alarme e APK cliente

## Objetivos

- Reconhecer pedido pendente interrompe imediatamente o toque daquele lote mesmo que haja outros pendentes.
- Cancelar `play()` assíncrono disparado antes do aceite; novo pedido pode gerar novo alerta.
- Tempo máximo de toque de 35 s, cancelamento de vibração e notificação ativa correspondente no SW.
- Push atrasado para pedido que já está em status não-pendente não rearma alarme.
- Nenhum listener adicional de Firestore, nenhuma alteração no checkout ou na criação de pedidos.
- APK **Cliente** com `br.com.dafamilialanches.cliente` abre apenas `https://dafamilialanches.com.br/`, pacote distinto do Admin.
- Geração determinística do Android cliente por cópia **em CI** do launcher Admin, sem tocar no código original Android Admin.
- Assinatura estável **compartilhada nesta fase** com o Admin via secret `DFL_ADMIN_KEYSTORE_BASE64`, mesma SHA-256, package distinto, assetlinks nas origens. Isso permite atualizações consistentes sem exigir nova configuração de secret; chave própria do Cliente pode ser migrada em uma fase posterior com plano de migração de assinatura (não substituir sem estratégia).
- Workflows têm seletor de alterações: Admin, Cliente, ambos ou nenhum (somente documentação/testes).
- `workflow_dispatch` aceita `ambos`, `admin`, `cliente` ou `automatico`. No push automático usa diferença entre before e HEAD (e fallback conservador para ambos).

## Arquitetura

No workflow `Build Android APK DFL Admin`, o job `scope` decide o que compilar. O job original `build` só é executado se `scope.admin=true`; o novo job `cliente` usa o mesmo template TWA com ícones do site público e package próprio.

A certificação com o Chrome em modo TWA depende de publicar o endpoint `/.well-known/assetlinks.json` na origem pública, que esta cirurgia atualiza. Se o Chrome não reconhecer a associação, o ABH recua para navegador seguro sem impedir compras. A associação HTTPS não concede acesso a dados privados.

## Falhas / segurança

- Preservar mudanças externas: não usar `git add -A`, nem `git reset --hard`.
- Backup local com snapshot e log, allowlist por arquivo, rollback para falhas anteriores a commit.
- Se o push falhar após commit, manter commit local e orientar envio seletivo após solucionar conectividade.
- Não criar pedidos de teste em produção, nem alterar regras Firestore, nem manipular secrets em arquivos.

## Homologação física

1. Abrir Admin e receber um pedido real; reconhecer deve parar áudio imediatamente.
2. Simular dois pendentes: reconhecer um para o som atual; pedido novo posterior pode rearmar.
3. Aceitar com internet lenta e conferir que a reconciliação não reinicia o toque.
4. Baixar os dois APKs no GitHub Actions de acordo com o tipo de mudança.
5. Abrir app Cliente em Android, validar TWA no domínio oficial, login, histórico, personalização e checkout, **sem criar pedidos fictícios**.
6. Confirmar que a assinatura e o update não substituem `DFL Admin` e que ambos coexistem.
