# V90 R4 — Gestão local de favoritos

- Usuário pode limpar a lista de favoritos com uma segunda confirmação explícita.
- A função de limpeza toca só a chave `dfl:saved-products:v1`, nunca limpa todo o localStorage.
- Se armazenamento estiver bloqueado, não mostra sucesso falso e mantém o diálogo aberto.
- Atualização local notifica a Home/Página do Produto via o evento já existente. Sem dados pessoais ou Firebase.
