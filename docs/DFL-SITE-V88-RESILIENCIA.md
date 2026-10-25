# V88 — Checkout e gate preventivo

- Impede abrir pedido paralelo pelo WhatsApp se o erro foi timeout, rede, idempotência, regra comercial ou falha desconhecida.
- Mantém recuperação e retentativa com clientRequestId, carrinho e rascunho intactos.
- Oferece canal manual somente quando o servidor informa SERVICE_CONFIG (negação de permissão, sem gravação).
- SERVICE_BUSY e SERVICE_UNAVAILABLE também são ambíguos: não exibem atalho paralelo.
- O gate local chama os mesmos testes declarados em build-admin-android.yml, incluindo suites aninhadas.
- Não toca em bancos, taxas, preço, integrações, APK ou VPS.
- VALIDAR NO ANDROID: simular timeout de checkout e conferir que o link paralelo não aparece.
