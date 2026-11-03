# DFL SITE R247 — Homologação premium visível no Admin

Base exata: `98d653bca5702d1ca4ca4915e934397be887bb8f` (R246).

## Objetivo prático

Deixar a personalização por unidade **visível e experimentável dentro do editor administrativo de um combo cadastrado**, sem divulgar uma função de venda incompleta para clientes. O usuário abre `Admin → Catálogo → Produtos → Editar um combo → Conteúdo → Experimente a personalização por lanche`.

A demonstração usa o catálogo que `CatalogAdmin` já carregou (sem novas leituras), inicia com dois combos, permite opções de uma unidade, várias ou todas, mantém planos separados, aceita observações e exibe conferência dos lanches e bobina 58/80 mm. O botão de adicionar ao carrinho permanece **desabilitado**.

## Arquitetura e escopo

- Novo `ComboUnitPremiumLabAdmin.tsx` + CSS: sheet full viewport no Android (safe areas), detalhes dourados premium, fundo escuro, aviso administrativo, suporte a Escape e foco capturado/restaurado. O componente não é montado em página pública.
- `CatalogAdmin.tsx`: botão restrito ao modal de edição de combo *já cadastrado* (`productMode === "edit"`), fonte de catálogo `products`/`addons` do hook existente. A prévia usa estado **já salvo**, não edição ainda pendente.
- `ComboUnitBatchConfiguratorDraft.tsx`: reforço de UX das escolhas, estados `aria-pressed`, ativo/parcial, prévia térmica interativa 58/80 mm aproveitando exclusivamente o motor R246. Mantém `canPrint:false`, `canCharge:false`, `canRelay:false`.
- `ComboUnitBatchConfiguratorDraft.module.css` e `ComboUnitBatchAuditDraft.module.css`: acabamento dark premium para o laboratório; nenhum CSS da loja pública modificado.
- `site-sales-protection.yml`: adiciona suíte R247 antes do gate geral, mantendo todas as regressões anteriores.

## Demonstração de referência

Dois Combo 7 Uai, cada um com 7 lanches. No Combo 1, Uai 2 sem alface (apenas se ingrediente removível explicitamente autorizado pelo Admin). No Combo 2, Uai 3 com bacon extra e Uai 7 com a observação `Molho separado`. O total simulado é formado por dois combos e adicionais do catálogo carregado; **nunca** representa preço autorizado. Nenhuma simulação aciona `window.print`, API de pedido, Firestore, outbox, WhatsApp ou DFL Entregas.

## Checkpoints para publicação

1. `main` exatamente no commit R246, árvore rastreada e stage limpos, sem conflitos de arquivos novos.
2. Backup dos cinco arquivos existentes alterados, manifesto SHA-256 de cada arquivo fornecido.
3. Aplicação por âncoras únicas e cópia dos arquivos do release.
4. Suite R247 + regressões de combos R246–R237, testes críticos de vendas existentes, TypeScript completo e `git diff --check`.
5. `git add --` somente nos nove arquivos autorizados, inspeção do stage, commit seletivo e push.
6. Falhou antes do commit? rollback somente desses arquivos; não há `reset --hard`, limpeza global ou `git add -A`. Push falhou depois do commit? preserva commit local e informa recuperação.

## Homologação manual pós-deploy

No celular, abra o painel Admin do Site. Edite `Combo 7 Uai` e vá até a etapa **Conteúdo**. Abra a demonstração e personalize as unidades em cada combo. Veja se as escolhas mudam de ativo/parcial e se o resultado aparece no espelho de cozinha. Alterne a bobina 58/80 mm e confira textos longos, rolagem e teclado. Feche com `×` sem salvar nada. Confira também checkout normal, preço do cardápio e carrinho legados.

## Limites

- **Acesso visual é Admin-only, não equivale à liberação comercial.** Nenhum checkout novo, API transacional ou impressão operacional foi ativado.
- O motor de preço do cliente ainda não é autoridade do servidor. Uma liberação comercial futura exigirá política de precificação validada pelo backend, estrutura de persistência versionada, consumidores compatíveis no Entregas e homologação ponta a ponta.
- A Action Android gera APK Admin no CI. O Site PWA recebe a demonstração administrativa após publicação; não é necessário montar APK no Termux.
