# DFL SITE R231 — Correção do gerador TWA Cliente

## Diagnóstico conferido no GitHub Actions

R229 (`41251221277`) e R230 (`41252126386`) falharam no job **DFL Cliente Android release**, etapa **Gerar APK cliente a partir do launcher estável**:

`R229: ancora ausente SafeLauncherActivity.java: admin.dafamilialanches.com.br`

É um bug do gerador, não dos ícones. Algumas classes Java não contêm o domínio, mas a função de substituição original o exigia em todas.

## Correção

- `package br.com.dafamilialanches.admin` continua obrigatório em toda classe Java de origem.
- Renomeações adicionais de domínio, aparência e funções são opcionais por arquivo.
- Verificação posterior bloqueia qualquer classe Cliente com package ou domínio Admin restante.
- R231 roda como parte do teste R230 já executado em CI; nenhum workflow precisa mudar.
- A identidade visual **não é alterada**: launcher arredondado, maskable oficial, cores do PWA e verificação pixel a pixel permanecem exatamente como na R230.
- O seletor de APKs identifica alteração em `scripts/prepare-client-android.py` como **somente Cliente**, portanto não recompila o Admin.

## Segurança

Backup por arquivo, HEAD fixo R230, branch main, stage vazio, alteração seletiva de quatro paths, regressões Node/TS e rollback antes do commit. Sem comandos de pedidos reais, Firestore ou build Android em Termux.

Se a Action do Cliente continuar falhando em etapa posterior, não afirmar que APK está homologado. Inspecionar o próximo log antes de distribuir APK.
