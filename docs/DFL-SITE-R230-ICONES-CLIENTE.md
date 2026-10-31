# DFL SITE R230 — Ícones oficiais do PWA no APK Cliente

## O que muda

- Fonte de verdade: `public/manifest.json`, e os PNGs públicos `icon-192x192.png`, `icon-512x512.png`, `icon-maskable-512x512.png`.
- Ícones comuns do Android gerados com a arte pública **em tamanho integral**, sem o padding de 86% e sem fundo artificial usado na R229. Apenas recorte transparente de cantos (22%) ou máscara circular no `ic_launcher_round.png`.
- Ícone adaptativo Android 8+ gerado do `maskable` **ocupando todo o foreground de 432px**, para o SO aplicar a máscara nativa. O maskable já foi projetado para respeitar área segura; não reduzir novamente para 68%.
- Fundo adaptativo e barra de sistema iguais ao `theme_color` declarado no manifesto público.
- Ícone de status monocromático deriva da arte PWA, sem reaproveitar recurso visual do Admin.
- O gerador recusa PNG ausente, tamanho incorreto ou ícone não declarado no manifesto público.
- Depois da geração, teste Python+Pillow compara **os pixels gerados** contra os arquivos do PWA, inclui densidades MDPI–XXXHDPI, arredondamento, adaptive, pacote Android e cores.
- O teste estático funciona no Termux sem compilar APK. O teste de pixels roda na Action com Pillow.
- Seletor de Actions considera o verificador de ícones um arquivo exclusivo do Cliente.

## Não muda

- Identidade `br.com.dafamilialanches.admin`, ícone do Admin, certificados, permissões, checkout, persistência, entrega, preços e regras do Firebase.
- Assinatura do Cliente segue o contrato R229 com a mesma chave estável `DFL_ADMIN_KEYSTORE_BASE64`; a chave não está neste pacote.
- Compilação Android ocorre apenas no GitHub Actions; o Termux faz patches, testes e commit seletivo.

## Operação segura

- Exige branch main no HEAD `c55e27bd284521ab8c9307bd4a731ed16364ed16` (R229 publicada).
- Não sobrescreve arquivos rastreados modificados, não usa `git add -A`, gera backup e aplica rollback no caso de teste falhar antes do commit.
- Comite e publica apenas o conjunto explícito de seis arquivos. Se o push falhar após o commit, mantém o commit local intacto.
- Nenhum pedido de teste é criado.

## Após GitHub Actions

- Abrir a Action Android, conferir a execução do job Cliente, baixar `DFL-Cliente-*`, instalar, conferir ícone no launcher Samsung e na tela de aplicativos, abrir pedido/histórico sem finalizar compra real.
- O desenho do PWA é a referência. A forma externa da máscara adaptativa pode variar conforme o launcher (círculo, squircular etc.), mas a arte usada é a mesma do PWA.
