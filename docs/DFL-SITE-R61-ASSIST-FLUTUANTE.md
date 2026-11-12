# DFL Site R61 — recuperar botao flutuante do DFL Assist

## Problema confirmado em producao
`DFLAssistFloatingNudge.tsx` continuava montado no AppShell, mas o CTA deixava de reaparecer depois do primeiro uso: `dfl:assist-open` gravava a mesma chave `localStorage` usada pelo botão de fechar. Concluir o guia (`dfl:assist-tour-v1`) também ocultava o botão para sempre. O comportamento era confundido com uma remoção da interface.

## Correção
- `dfl:assist-floating-dismissed-r61` fica reservado exclusivamente ao fechamento explícito pelo X. A chave antiga r251 era ambígua, pois marcava tanto uso quanto recusa; não dá para inferir qual foi o gesto, por isso ela não é reutilizada.
- Abrir/fechar o assistente, ou concluir a apresentação inicial, não são motivos para silenciar o atalho.
- O botão continua aparecendo com scroll >=240px, com animação inicial uma vez por sessão; segue invisível no rodapé, com campo/teclado em foco, em modais e em outras rotas.
- Não altera a página principal, navegação inferior, Assist real, checkout, campanhas, Firebase, Mensageria 360, notificações nem APIs.

## Aceite
1. Na Home, depois de rolar ao menos 240px, aparece o flutuante `Ajuda` ou `Precisa de ajuda?`.
2. Toque no flutuante, feche o assistente e role novamente: o flutuante reaparece.
3. Concluir o guia não desativa o botão de ajuda.
4. Ao alcançar o rodapé, o botão some; ao subir, volta.
5. Abrir um modal, focar campo, usar o teclado, mudar de rota: CTA não cobre os controles.
6. Ao tocar no X, só então o flutuante some e a recusa é persistida neste aparelho.
7. Modo redução de movimento: sem animação de digitação.

## Estado de release
Cirurgia local com rollback; publicação separada mediante aprovação. APK Android NÃO é necessário para a função web aparecer no Site/PWA. A reinstalação do contêiner TWA só é necessária por outros motivos nativos.

## FIX1 — compatibilidade com React Hooks ESLint
- Corrige os quatro bloqueios `react-hooks/set-state-in-effect` sem suprimir a regra.
- Leitura inicial do storage, medição de rolagem e fase inicial de animação passam por `requestAnimationFrame`, com cancelamento no unmount.
- Transição de digitação para espera passa pelo callback do timer, sem setState direto em efeito.
- Installer e publicador agora aplicam ESLint no componente efetivamente alterado, além do contrato.
- O comportamento de botão persistente (apenas X dispensa), modal, teclado, rodapé e movimento reduzido permanece.

## FIX2 — pacote com identidade exclusiva
- Corrige distribuicao de ZIP anterior: diretório e filename únicos para evitar execução acidental da versão antiga.
- Instalador exige pasta exclusiva e valida presença do patch React Hooks FIX1 antes de modificar o repositório.
- ESLint no TSX alterado ANTES da regressao de 69 testes, sem suprimir regras.
- As mudanças de aplicação são equivalentes à FIX1; o FIX2 garante aplicação correta no Termux.

## FIX3 — preflight exato do patch
- O instalador FIX2 contava 2 aparições de `const storageFrame` (alteração + assert).
- O FIX3 usa uma busca de linha exata para validar a única instrução correta antes de tocar o repositório.
- Nenhuma lógica de produção extra foi modificada: preserva JSX, R102, cobertura de 69 suítes, ESLint, TypeScript e rollback.
