# DFL SITE R56 — Central de versões Android certificadas (fase segura)

## Tomografia real (11/11/2026)

- Os APKs **Admin** (`br.com.dafamilialanches.admin`) e **Cliente** (`br.com.dafamilialanches.cliente`) são **TWA**. O código do Cliente é gerado em CI a partir do launcher Admin, com identidade e assets próprios (`scripts/prepare-client-android.py`).
- Finance é **Capacitor**, não TWA. O `native/r464/DflApkUpdaterPlugin.java` do Finance depende de Capacitor e NÃO é transplantável diretamente.
- O Site já tinha workflow `build-admin-android.yml` com build, keystore estável, verificação do SHA-256 da assinatura, pacote e artefatos Actions com retenção **7 dias**, mas **sem GitHub Releases duráveis** ou API de versões certificadas.
- O Admin tem uma Central de Notificações efetiva, prefs locais `dfl-admin-notification-prefs-v31`, Service Worker e push FCM. Não criar um segundo motor. O Cliente não faz push operacional nem pede permissão inicial.
- A UI web da TWA não tem acesso verificável a `PackageManager.versionCode`. Não inferir a versão instalada por deploy ou user agent. A R56 não anuncia "versão nova" com base no Site.
- O Admin solicita permissão Android nativa na abertura; qualquer mudança exige testes de delegação do AndroidBrowserHelper e homologação em dispositivo, para não matar push de novos pedidos. **Não alterar neste pacote.**

## O que a R56 entrega de fato

1. Dois jobs de GitHub Releases, um por app. Apenas com `vars.DFL_ANDROID_RELEASES_APPROVED == 'true'`, depois de build aprovado, revalidam APK, pacote, versionCode e SHA-256 do certificado. Releases e checksums têm nomes e tags específicos.
2. API `/api/updates/android?app=admin|cliente` consulta Actions e GitHub Releases publicamente, cruza commit, número de build, status da Action, tag, asset, tamanho, SHA-256 e URL canônica. Sem credenciais em cliente.
3. Duas telas: `/atualizacoes` e `/admin/atualizacoes`. Destacam versão Android certificada, se existir; caso contrário mostram claramente a ausência. Erros de rede nunca viram versão disponível.
4. Navegação Cliente no rodapé público; Admin na central de notificações existente.
5. Central do Admin: remove a falsa confirmação de ativação de push por timer. A confirmação de sincronização vem do evento existente `dfl:admin-push-sync-complete`, com timeout honesto. Preferências passam a mostrar erro se não salvar em localStorage.
6. Testes herméticos, TypeScript, gates Android e rollback seletivo. Sem tocar em pedidos, meios de pagamento, Firestore, SMS, WhatsApp ou Evolution.

## O que NÃO está entregue nesta fase (não fingir)

- **Download dentro do APK, progresso, cancelamento, SHA do arquivo local, conferência do certificado instalado e instalador**: exigem uma Activity/ponte nativa TWA específica, FileProvider, controle de intents e homologação com dois APKs diferentes. Esta R56 apenas exibe link oficial para a Release certificada, sem instalar automaticamente.
- **Versão instalada verificada**, notificações nativas opcionais de versão nova ou monitoramento em segundo plano: exigem a mesma ponte. Não adicionar chaves falsas nem pedir permissão no Cliente sem recurso real.
- Horários/frequência/grupos novos de notificações: as opções atuais do Admin continuam com o motor existente, não há segundo agendador.

## Como liberar GitHub Releases depois de revisar

Em `Settings > Secrets and variables > Actions > Variables` do repositório, criar `DFL_ANDROID_RELEASES_APPROVED` com valor **`true`**, apenas após aprovação de distribuição pública dos APKs. **Não configurar antes de revisar os riscos**, porque o repositório GitHub é público e as Releases também serão públicas. O primeiro commit da R56 não cria Releases enquanto a variável estiver ausente ou diferente de `true`.

As releases usam tags `dfl-admin-android-<run_number>` e `dfl-cliente-android-<run_number>`, builds `DFL-Admin-<run_number>.apk` e `DFL-Cliente-<run_number>.apk`.

## Homologação posterior obrigatória

O fluxo nativo exigirá verificar em dispositivo real versão instalada (número do Android), arquivo baixado, hash, certificado estável, identidade exata, permissões de fonte desconhecida, cancelamento, rede interrompida, falta de espaço e installer oficial. A primeira versão com ponte precisará ser instalada manualmente, igual ao Finance R464. Somente a versão seguinte poderá demonstrar atualização nativa de ponta a ponta.

## Gates desta cirurgia

- Aplicação somente em `main`, `HEAD == origin/main`, alvos limpos, blobs de origem conferidos.
- Contratos R56, Admin notifications existentes, Android tests e `tsc --noEmit`. CI Android faz compilação Gradle no GitHub e **nunca** no Termux.
- Backup e restauração dos 12 caminhos alterados; commit/push opcional em `PUBLICAR.sh`, nunca automático no instalador.
