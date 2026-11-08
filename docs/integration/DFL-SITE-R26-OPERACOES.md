# DFL Site R26 — operações integradas e segurança de fila

## Entrega
- Console **DFL 360 — Aceites, mensagens e acompanhamento** dentro de Ferramentas avançadas da Central de Mensageria do Admin.
- Consulta manual, owner/admin verificado com Firebase token revogado (`verifyIdToken(token,true)`), sem listeners, sem polling, sem mutação ou exposição de telefone, número de pedido, token, URL, segredo e ID do provedor.
- Leitura limitada a 24 registros de cada uma das três coleções. Indicadores SÃO AMOSTRAS e **não** representam a contagem absoluta da fila. Falha parcial é identificada.
- Estado `provider_accepted` significa **apenas aceitação pela API do provedor**, nunca leitura ou recebimento no WhatsApp.
- A fila `tracking_auto_initial_handoffs_v1` mantém intenção única e revisão de falhas incertas: nunca reaproveitar grants ou links.
- A liquidação do aceite automático agora confirma o `locked_by` e `state=processing` na transação; um worker antigo não sobrescreve a decisão de outro worker.

## Chaves e segurança
- Nenhuma flag é alterada por essa cirurgia. Não conecta o provedor e não realiza envio ou emissão de link.
- `DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED` não autoriza por si só a automação; é necessária homologação real dos dois lados, provider e entidade correta.
- A R25 segue desacoplada: a implementação da camada confiável de envio depende de contrato validado do provedor, uma única chamada e receipt explícito.
- Site e Entregas seguem **separados**. Nenhuma credencial migra para frontend, Android ou fila persistente.

## Operação de abertura
- Com flags OFF, é seguro consultar o painel, mas não há disparos automáticos novos.
- Para diagnosticar: Admin > Comunicação > Central de Mensageria > Ferramentas avançadas > Conferir filas.
- Se houver revisão: confirmar logs e estado Firestore antes de qualquer ação. A R26 é somente leitura.

## Próximas etapas
1. Homologar transporte real e payload do provedor (incluindo limitações do Supabase Edge Function), sem armazenar token.
2. End-to-end com pedido consentido de teste, cancelamento, retirada, terminalidade, provider reject/timeout e troca de empresa.
3. Auditoria visual de conversão dos seis prints (Home, produto, carrinho, endereço, pagamento, meus pedidos) antes de novos ajustes no checkout.
