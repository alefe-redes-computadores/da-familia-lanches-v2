# DFL Site R57 — Ponte Android nativa de atualizações TWA

Base: R56 (certificador público somente leitura + dois jobs GitHub Releases desativados por padrão). Pacotes: `br.com.dafamilialanches.admin` e `br.com.dafamilialanches.cliente`.

## Funcionamento

1. Na Central de Atualizações web, o botão **Atualizar no aplicativo Android** usa um Intent URI com pacote explícito. Abre `UpdateActivity`, via filtro `dflupdate://updates`. O Intent não aceita URL, checksum, versão, sabor ou extras provenientes do navegador.
2. A Activity lê o `versionCode` realmente instalado com `PackageManager` e consulta exclusivamente `https://dafamilialanches.com.br/api/updates/android?app=admin|cliente` conforme flavor embutido no binário. A API R56 só oferece Github Release cujo SHA, Action do mesmo commit e digest coincidem.
3. A Activity revalida também pacote, tamanho, SHA e URL canônica da release. Só oferece download quando o build da Action é superior ao `versionCode` instalado; consultas com erro não disponibilizam APK.
4. Download HTTPS para armazenamento privado da aplicação, com lista fechada de hosts de redirecionamento. Usa tamanho exato, SHA-256 incremental, progresso real de bytes/porcentagem, cancelamento e eliminação do arquivo parcial. Não aceita URL arbitrária.
5. Antes de indicar download pronto e **novamente antes de instalar**, valida tamanho/ SHA-256, packageId, versionCode superior e certificado atual + novo igual à assinatura oficial da DFL (fingerprint SHA-256 aprovado pelo Digital Asset Links). A comparação exige certificado idêntico, não transfere identidade entre os APKs.
6. `FileProvider` interno, com caminho restrito `files/dfl-apk-updates/`, entrega URI temporária ao instalador oficial. Para Android 8+ solicita autorização em Configurações somente quando necessária; no retorno revalida APK e abre a confirmação do Android. Não há instalação silenciosa.
7. Se TWA/Chrome não reconhecer o Intent, o link fornece fallback HTTPS para a página do GitHub Release certificado. O primeiro APK que contém R57 deve ser instalado manualmente; somente um APK posterior pode ser atualizado pelo fluxo nativo.

## CI e segurança

- Sem build Gradle no Termux. Os dois APKs são gerados no GitHub Actions, com `versionCode=GITHUB_RUN_NUMBER`, AndroidX FileProvider e assinatura estável, conforme gates existentes.
- O gerador Cliente copia o launcher-base Admin e reescreve **somente** o flavor do `UpdateActivity` para `cliente` (falha se marcador ausente/duplicado). Modificações de UpdateActivity, manifest, file paths ou Gradle disparam **ambos** os APKs.
- Releases GitHub permanecem desligadas sem a variável GitHub `DFL_ANDROID_RELEASES_APPROVED=true` e exigem jobs assinados aprovados. A liberação da variável é ato separado, após revisão de distribuição e identidade pública dos APKs.
- Se houver APK/Action sem release, API retorna indisponível e não se anuncia update. Atualizações do site web/PWA são outra coisa.
- Nenhum banco de dados, Pix, checkout, promoção, bot financeiro, Evolution ou Mensageria 360 foi alterado.

## Homologação física obrigatória

1. Validar CI Admin/Cliente e os dois APKs assinados. Só então aprovar releases duráveis, se a política de distribuição pública for aceita.
2. Instalar manualmente o **primeiro** APK R57 nos dois aplicativos, preservando os dados. O fingerprint precisa corresponder ao app atualmente instalado.
3. Quando houver **uma versão real posterior**, abrir Central, tocar em atualizar, observar build, MB e porcentagem, testar cancelamento e baixar novamente.
4. Conferir fluxo de permissão negada e permitida, retorno das configurações, prompt oficial do sistema, reinício, dados e acesso TWA. Testar versão já atual, offline e pouco espaço.
5. Rejeitar pacote trocado, assinatura diferente, SHA ou tamanho incorreto, downgrade e anúncio sem release. Homologar em Android 8–17 se fizer parte da base real de usuários.

## Limites transparentes

- Não existe verificação permanente em segundo plano: a consulta ocorre ao abrir a central/atualizador ou após interação.
- Downloads não continuam se a Activity for encerrada; se isso ocorrer, o download é cancelado e deverá ser reiniciado. Não há serviço em background.
- Sem R58 ainda não existem alertas locais opt-in de nova versão nem histórico de instalação; preferências de notificações do Admin continuam independentes.
- O código Java é compilado na Actions, não no Termux. A R57 é aprovada localmente somente por contratos, parser TS, TypeScript, XML e testes direcionados; o teste Android real é obrigatório para declarar o fluxo de instalação homologado.
