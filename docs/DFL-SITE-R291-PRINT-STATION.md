# DFL SITE — R291 | Print Station para Windows (gates OFF)

## Estado e escopo

- **Etapa 1** já existente: Admin → Pedido → Imprimir → 58 mm/80 mm; teste curto de largura; duas vias (Cozinha / Completa); prévia manual. **Não alterada** para proteger os contratos R4/R5/R6.
- **Etapa 2** implementada em código, **NÃO homologada em impressora física**: outbox de impressão do Site + API autenticada + agente Windows em Electron mínimo (somente estação de impressão).
- **Sem impressão automática por padrão**. Nenhuma flag de produção é modificada pelo pacote. Não integra automaticamente o iFood: o Gestor iFood continua usando sua própria fila do Windows; o DFL usa a mesma impressora, desde que driver e disponibilidade permitam.
- **Não existe garantia de papel saído** pelo callback do Electron. Status `spool_submitted` significa apenas aceito para a fila do Windows. Timeout ou erro exige revisão manual.

## Modelo de comprovante (baseado no contrato do iFood, sem copiar sua arte)

- Via **Cozinha**: número abreviado, data, entrega/retirada, status/agendamento, cliente, quantidade × produto, adicionais e observação de cada item, observação geral. Oculta telefone/endereço/valores.
- Via **Completa**: inclui informações de entrega, cobrança, subtotal, taxa, desconto, cupom, pagamento, troco e total quando presentes.
- Base `src/lib/thermalReceipt.ts` existente: texto escapado contra HTML, largura útil conservadora de 48 mm para bobina nominal de 58 mm. A área útil real depende do driver. Não enviar comandos ESC/POS ou de corte antes do diagnóstico físico.

## Integração transacional

No `POST /api/orders` o pedido novo (não agendado) cria, **na mesma transação Firestore**, 0/1/2 documentos `integration_print_jobs` conforme flags. IDs determinísticos por pedido/via: `print-v1__site_<digest>__kitchen|full`. Checkout reutilizado não gera novos tickets. Conteúdo da fila contém apenas ID/via/papel/estado, sem endereço, telefone ou itens; os dados são lidos do pedido canônico *somente no claim* autenticado. O iFood não gera jobs nesta fila.

A API `POST /api/integration/printing` é exclusiva do agente (cabeçalho secreto), sem acesso de navegador, sem CORS aberto. `claim` usa transação, reconfirma pedido e status, rejeita antigos (+30 min) e cancelados. `ack` marca aceito pelo spooler; `problem` marca revisão. Nenhum estado é rearmado/reprocessado automaticamente. Em caso de crash após claim, o trabalho permanece **claimed** até conciliação manual. Isso evita reimpressões silenciosas.

## Flags de produção (TODAS devem ser configuradas conscientemente, após homologação física)

```text
DFL_PRINT_AUTO_ENABLED=true
DFL_PRINT_AGENT_ENABLED=true
DFL_PRINT_AGENT_TOKEN=<segredo aleatorio com 32-160 caracteres ASCII alfanumericos/underscore/hifen>
DFL_PRINT_AUTO_TICKET_MODE=kitchen   # ou both somente apos validar as duas vias
DFL_PRINT_PAPER_MM=58              # confirme papel e driver antes
```

NÃO cadastre essas flags agora. **A ausência de qualquer uma mantém a criação automática OFF.** Configurar `false` não ativa. O mesmo token deve ser inserido apenas no ambiente local do agente Windows, nunca no Javascript da página nem em arquivo público. Para gerar segredo no Windows, use PowerShell: `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()`; em sistemas mais antigos use um gerador criptograficamente seguro equivalente.

## Windows — futuro teste físico guiado

1. Confirmar modelo e largura da bobina; instalar driver do fabricante e testar o equipamento pelo Windows/iFood, sem trocar configurações que já funcionam no Gestor.
2. Executar `scripts/usb-thermal-windows-diagnose.ps1` (somente leitura). Conferir **nome exato da fila**.
3. Pelo Admin DFL, abrir pedido antigo/encerrado e imprimir só `Conferir largura: teste curto da bobina`, depois uma via Cozinha e uma Completa.
4. Instalar Node LTS + dependências `npm install` **no notebook**, na pasta `tools/dfl-print-station`; `npm run doctor` mostra impressoras, sem criar jobs, quando modo OFF.
5. Fazer homologação de servidor e notebook em janela controlada, número de pedidos monitorado, flags explícitas, impressora presente, variáveis do processo local definidas (modelo abaixo). Ativar **primeiro `kitchen`**, sem jobs antigos, e conferir uma compra autorizada.

```powershell
$env:DFL_PRINT_STATION_URL = 'https://www.dafamilialanches.com.br/api/integration/printing'
$env:DFL_PRINT_STATION_PRINTER = 'NOME EXATO DA FILA DO WINDOWS'
$env:DFL_PRINT_STATION_TOKEN = Read-Host 'Token autorizado (nao compartilhe)'
$env:DFL_PRINT_STATION_MODE = 'off'   # diagnostico; nunca liga com esse valor
npm run doctor
# Quando a operacao estiver fisicamente homologada, em sessao supervisionada:
# $env:DFL_PRINT_STATION_MODE = 'print'
# $env:DFL_PRINT_STATION_ARMED = 'YES'
# npm start
```

O token do processo é uma credencial privilegiada. Não o cole em chat, não o salve no repositório e não permita scripts externos acessarem sua sessão. A estação restringe o servidor a `www.dafamilialanches.com.br`/`dafamilialanches.com.br` via HTTPS. Os jobs são consultados até a cada 6 s, sem listeners permanentes no Firestore. Se o notebook desligar, a fila aguarda, mas trabalhos com mais de 30 minutos são enviados para revisão, **não são impressos automaticamente**.

### Segurança / rollback

- Voltar qualquer flag para `false` e redeploy do Site para parar a geração e o claim.
- Parar o processo Electron no Windows interrompe o polling; nenhuma impressão em andamento é garantidamente reversível.
- O instalador R291 cria backup do único arquivo existente que altera (`src/app/api/orders/route.ts`), faz hash estrito, testa e publica apenas allowlist.
- Não altera o `thermalReceipt`, gestão iFood, checkout API de pagamento, regras do Firestore, catálogo ou mensageria. O agente **não tem acesso direto ao Firebase**.
- **Sem homologação física**, mantenha automático OFF e use a prévia manual; Print Station é uma base para o futuro DFL Gestor Desktop, não um produto Windows já instalado.

## Próximas evoluções

Central administrativa de impressão: estados e erro, reimpressão manual confirmada depois de conciliar com spooler, operador e auditoria. Empacotar Electron/atualizações assinadas, seletor de impressoras e serviço Windows após homologar driver. Somente então decidir se toda a UI do Admin migrará para Electron ou se seguirá com PWA integrado.

Fontes: iFood Developer `https://developer.ifood.com.br/en-US/docs/food/guides/modules/order/details`; Electron `https://www.electronjs.org/docs/latest/api/web-contents` e `https://www.electronjs.org/docs/latest/tutorial/security`.
