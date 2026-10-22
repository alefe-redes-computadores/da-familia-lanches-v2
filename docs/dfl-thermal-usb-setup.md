# DFL Site V85.1 R5 — USB genérica, teste seguro

**Estado:** diagnóstico e calibração manual. Nenhum job automático, driver ou fila foi instalado.

A impressora foi informada como USB, marca genérica. **Não há evidência ainda de modelo, protocolo ESC/POS, largura real, driver, corte ou sistema operacional do notebook.** Uma USB genérica não autoriza enviar comandos ESC/POS cegamente.

## Teste físico em notebook Windows (quando disponível)

1. Conecte cabo USB e energia da impressora ao notebook. Instale o driver compatível somente de fonte confiável e confirme que a impressora aparece no Windows.
2. Rode `scripts/usb-thermal-windows-diagnose.ps1` no PowerShell. O diagnóstico é SOMENTE LEITURA e lista nome da fila de impressão, driver e identificação USB; não imprime e não altera o sistema.
3. Em **Preferências de impressão** configure largura nominal da mídia (provavelmente 58 mm; confirme medindo a bobina). Use escala 100%, margens zero se suportadas, orientação retrato e não imprima cabeçalhos/rodapés do navegador.
4. Depois de publicar V85.1 R4/R5, abra um pedido no Admin, toque **Imprimir**, selecione **Bobina 58 mm**, depois **Conferir largura: teste curto da bobina**.
5. Confira a prévia e imprima **SOMENTE teste curto**. A tirinha deve mostrar as bordas ESQUERDA e DIREITA. Se qualquer borda sumir, corrija driver antes de imprimir um pedido real.
6. Somente depois faça UM teste de pedido fictício ou pedido já encerrado, conferindo acentos, adicionais, preço, observação e endereço. Não imprima dados de clientes sem necessidade operacional.

## O que significa a largura do ticket?

- Papel de **58 mm** costuma ter cabeçote útil de **48 mm / 384 pontos** em muitos equipamentos, mas NÃO é universal.
- Papel de **80 mm** costuma ter área útil próxima de **68–72 mm**, variando conforme fabricante.
- O CSS do Site **não controla a largura da bobina nem o corte físico**. É o driver/spooler ou o protocolo específico da impressora que determina alimentação/corte.

## Plano da ponte USB após identificar modelo

`Site/iFood/99Food (origens comerciais) → print job idempotente → agente local autenticado no notebook → fila do Windows/ESC-POS verificado → impressora USB`.

**Regra:** começar apenas com impressão manual. Para automatizar, identificar driver/protocolo, validar spooler e implantar deduplicação por origem + pedido + revisão + tipo de ticket. **Não** colocar chaves privadas, acesso Firestore privilegiado ou credenciais do Admin no agente sem desenho de segurança específico.

**Status após R5:** impressão automática DESATIVADA. Sem alterações do checkout, cancelamentos, rotas, pagamentos, notificações ou backend.
