import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(path, "utf8");

const success = read(
  "src/components/ui/OrderSuccessModal.tsx",
);

const successCss = read(
  "src/components/ui/OrderSuccessModal.module.css",
);

const cartCss = read(
  "src/components/ui/CartModal.module.css",
);

const rescue = read(
  "src/components/ui/OrderRescueActions.tsx",
);

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V16: ${message}`);
  }
};

ok(
  !success.includes("OrderRescueActions"),
  "sucesso normal ainda renderiza Plano B",
);

ok(
  !success.includes(
    "Pedido salvo e pronto para compartilhar",
  ),
  "texto de resgate ainda aparece no sucesso",
);

ok(
  !success.includes(
    "Enviar resumo no WhatsApp",
  ),
  "WhatsApp ainda é apresentado como reenvio do pedido",
);

ok(
  success.includes(
    "Acompanhar meu pedido",
  ),
  "CTA principal de acompanhamento ausente",
);

ok(
  success.includes(
    "Chamar no WhatsApp",
  ),
  "atalho discreto de suporte ausente",
);

ok(
  success.includes(
    "Enviar comprovante pelo WhatsApp",
  ),
  "fluxo PIX perdeu envio de comprovante",
);

ok(
  success.includes("clearCart()"),
  "decisão explícita de limpeza do carrinho foi perdida",
);

ok(
  success.includes(
    "Seu pedido já está seguro.",
  ),
  "carrinho não comunica segurança após sucesso",
);

ok(
  rescue.includes("PLANO B"),
  "componente de resgate foi removido do projeto",
);

ok(
  rescue.includes("Copiar") &&
    rescue.includes("Compartilhar") &&
    rescue.includes("Instagram"),
  "Plano B perdeu canais de contingência",
);

ok(
  successCss.includes(".support"),
  "estilo do suporte WhatsApp ausente",
);

ok(
  cartCss.includes(
    "V16 — CART NOTICE CONTRAST",
  ),
  "correção visual do aviso do carrinho ausente",
);

ok(
  cartCss.includes("#5f4800!important"),
  "aviso do carrinho continua sem contraste confiável",
);

console.log(
  "V16 checkout success + rescue separation: OK",
);
