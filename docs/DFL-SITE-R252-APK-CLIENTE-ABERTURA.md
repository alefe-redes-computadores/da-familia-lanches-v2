# DFL SITE R252 — APK Cliente: abertura premium, sem moldura

## Escopo

Exclusivamente o APK **Cliente**, gerado em GitHub Actions. A identidade vem dos arquivos oficiais `public/icon-512x512.png` e `public/manifest.json` já usados pelo favicon/PWA. Não editar estes arquivos, nem o ícone do launcher, nem o Admin.

## Alterações

- A imagem nativa `splash.png` é criada em 1152×1152, com marca extraída da arte oficial sem cartão preto arredondado, sem borda ou fundo branco, sobre `#111111`.
- O texto “Preparando seu cardápio…” é parte da composição estática, sem bloquear o carregamento e sem introduzir timeout artificial.
- Android 12+ recebe um ícone de splash transparente com marca, e cor de fundo escura.
- A tela inicial `EntryActivity` usa um tema escuro para não mostrar uma janela branca.
- `SafeLauncherActivity` habilita o mecanismo de splash TWA do Android Browser Helper 2.7.3, com FileProvider restrito a `twa_splash/`, fade de 240 ms e escala `CENTER_INSIDE`.
- Os segredos, dados, rotas, compras, status de pedidos, notificações e autenticação **não são modificados**.

## Segurança e validação

- O FileProvider só compartilha o arquivo de splash, não oferece caminhos genéricos.
- Chaves de assinatura e permissões do app permanecem inalteradas.
- O Admin é apenas fonte de template temporária e nunca é editado.
- Termux: testes estáticos e TypeScript devem passar antes do push seletivo.
- GitHub Actions: `prepare-client-android.py` gera todos os recursos, e `verify-client-android-icons.py` valida PNGs, theme, manifesto, FileProvider, identidade e a imagem sem moldura antes do Gradle.
- Teste físico necessário: abrir 2× a partir do ícone, abrir após fechar completamente, com e sem autenticação. A quantidade de flashes depende do Android, Chrome, rede e cache: não prometer zero flashes antes de confirmar no aparelho.
- O build de APK Cliente precisa ser realizado e assinado no GitHub; a execução local não constrói APK.

## Origem da documentação

Android Browser Helper TWA splash documentation e Chrome Android Integration Guide: FileProvider `twa_splash`, `SPLASH_IMAGE_DRAWABLE`, `SPLASH_SCREEN_BACKGROUND_COLOR`, `SPLASH_SCREEN_FADE_OUT_DURATION`, `FILE_PROVIDER_AUTHORITY`.
