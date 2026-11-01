# DFL SITE R232 — Primeira abertura do Cliente / TWA e homologação

**R232-R2, hotfix do pacote R232 bloqueado na validação local.**

**Base obrigatória:** R231 publicada, commit `ab4790fcf1fdbaf7bf3302ed931bca1dbfd7bf87` em `main`.

## Problema real corrigido

O launcher Cliente foi derivado do Admin, portanto herdou a solicitação imediata de `POST_NOTIFICATIONS` da camada Java Android. O Cliente ainda **não possui serviço de push habilitado**; o pedido de permissão no início não acrescentava valor e atrapalhava a primeira navegação. Esta cirurgia remove **apenas do APK Cliente gerado** a Activity de permissão, a entrada do Manifest e o gate Java. O APK Admin continua com a permissão e seus alertas, sem alteração.

## Proteção implementada

- Cliente abre diretamente a TWA do domínio público `https://dafamilialanches.com.br/`, sem solicitar push.
- Manifest ainda permite **INTERNET**, conserva TWA launcher, trust delegation, permissões de segurança e associações HTTPS, bloqueia host do Admin.
- `br.com.dafamilialanches.cliente` e `br.com.dafamilialanches.admin` são pacotes distintos; mesmo certificado estável é preservado; não solicitar novas chaves.
- Ícones legados arredondados e adaptive/maskable **permanecem derivados dos PNGs oficiais do PWA**; nenhum ícone novo ou fallback visual.
- Gate JS R232 roda dentro do gate R230 já existente; verificação de arquivos Android gerados roda dentro de `verify-client-android-icons.py` já chamado pela CI. **Nenhum workflow foi modificado**: seletor vai compilar só Cliente.
- Tudo sintético, sem acesso ao Firebase comercial, sem pedidos de teste.

## Instalação e segurança

Execute `bash ~/storage/downloads/instalar-r232.sh` depois de extrair o ZIP em Downloads. A cirurgia exige `main` no SHA da R231, sem diff rastreado ou stage preexistente; faz backup seletivo; roda regressões, TypeScript e valida diff; faz commit e push seletivo de 6 caminhos somente quando aprovado. Em falha antes do commit, rollback seletivo. Em falha após commit/push, não faz reset nem novo commit.

## Homologação física (após APK na GitHub Action)

1. Instale **DFL Cliente** pela Action da R232 (o Admin já instalado deve permanecer separado).
2. Observe nome, ícone redondo, splash e abertura do site público em tela cheia; **sem popup nativo de notificações**.
3. Abra uma promoção, a página completa de produto e volte diversas vezes — sem tela congelada ou rolagem bloqueada.
4. Adicione um item ao carrinho e altere sua quantidade. Não finalize um pedido de teste.
5. Confira login/histórico, retorno pela navegação Android, teclado, geolocalização opcional e formulário de endereço sem concluir compra.
6. Teste sinal fraco, volte à conexão normal e confira se o carrinho permanece. Não envie pedido via WhatsApp como teste.
7. Compare a imagem do Cliente na tela inicial com o PWA oficial. O recorte pode variar por launcher Android; a arte não pode mudar.
8. Se Chrome abrir com barra de endereço em vez de tela cheia, conferir Digital Asset Links/domínio/certificado e o navegador padrão antes de alterar código.

**Limite importante:** tests/CI certificam código, pacote e assinatura; eles **não substituem** homologação física em um Android real, nem comprovam funcionamento offline para todo tipo de navegação.

## Correção R232-R2 — retry do diagnóstico

O gerador anterior assumia uma única chamada do gate de notificações. O Admin mantém duas chamadas: no `onCreate` e no botão "Tentar abrir novamente" após um diagnóstico de erro. A R232-R2 exige e transforma os dois pontos separadamente para `launchTwa()`, sem alterar o template do Admin. A validação impede que o botão de retry reintroduza o prompt. Nenhum código de checkout é alterado.
