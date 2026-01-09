import type { Product } from "./types";

/**
 * Fonte: HTML antigo DFL v9.2 (seções: Combos, Tradicionais, Artesanais, Hot Dogs, Bebidas)
 * Categorias:
 * - combo
 * - burger (tradicionais + artesanais; tag define tipo)
 * - hotdog
 * - drink
 * - promo (preparado; promoções eram geradas por JS no site antigo)
 */

export const mockProducts: Product[] = [
  // =========================
  // 🧡 COMBOS
  // =========================
  {
    id: "combo-casal-tradicional",
    name: "Combo Casal Tradicional",
    category: "combo",
    price: 34.99,
    description: "2 Burger Trem + 1 Fanta 1L.",
    tags: ["Combo"],
  },
  {
    id: "combo-casal-artesanal",
    name: "Combo Casal Artesanal",
    category: "combo",
    price: 49.99,
    description: "2 Burger Peleja + 1 Fanta 1L.",
    tags: ["Combo"],
  },
  {
    id: "combo-familia-tradicional",
    name: "Combo Família Tradicional",
    category: "combo",
    price: 59.99,
    description: "4 Burger Trem + 1 Kuat 2L.",
    tags: ["Combo"],
  },
  {
    id: "combo-familia-artesanal",
    name: "Combo Família Artesanal",
    category: "combo",
    price: 84.99,
    description: "4 Burger Peleja + 1 Kuat 2L.",
    tags: ["Combo"],
  },

  // =========================
  // 🍔 TRADICIONAIS (burger)
  // =========================
  {
    id: "bao",
    name: "Bão",
    category: "burger",
    price: 11.0,
    description:
      "Pão, hambúrguer, alface, tomate, presunto e mussarela. Acompanha ketchup sachê.",
    tags: ["Tradicional", "Molho Verde"],
  },
  {
    id: "uai",
    name: "Uai",
    category: "burger",
    price: 13.0,
    description:
      "Pão, hambúrguer, milho, bacon, alface, tomate, presunto e mussarela. Acompanha ketchup sachê.",
    tags: ["Tradicional", "Molho Verde"],
  },
  {
    id: "trem",
    name: "Trem",
    category: "burger",
    price: 14.0,
    description:
      "Pão, hambúrguer, salsicha, bacon, milho, alface, tomate, presunto e mussarela. Acompanha ketchup sachê.",
    tags: ["Tradicional", "Molho Verde"],
  },
  {
    id: "cadim",
    name: "Cadim",
    category: "burger",
    price: 17.0,
    description:
      "Pão, hambúrguer, 1 filé frango, bacon, milho, salsicha, alface, tomate, presunto e mussarela. Acompanha ketchup sachê.",
    tags: ["Tradicional", "Molho Verde"],
  },
  {
    id: "armaria",
    name: "Armaria",
    category: "burger",
    price: 18.0,
    description:
      "Pão, 1 hambúrguer, 1 filé frango, bacon, milho, batata palha, alface, tomate, salsicha, presunto e mussarela. Acompanha ketchup sachê.",
    tags: ["Tradicional", "Molho Verde"],
  },
  {
    id: "bitela",
    name: "Bitela",
    category: "burger",
    price: 22.0,
    description:
      "Pão, 2 hambúrgueres, filé frango, bacon, milho, batata palha, alface, salsicha, tomate, presunto e mussarela. Acompanha ketchup sachê.",
    tags: ["Tradicional", "Molho Verde"],
  },
  {
    id: "apruma",
    name: "Apruma",
    category: "burger",
    price: 25.0,
    description:
      "Pão, 3 hambúrgueres, filé frango, bacon, salsicha, milho, batata palha, alface, tomate, 2 presuntos e 2 mussarelas. Acompanha ketchup sachê.",
    tags: ["Tradicional", "Molho Verde"],
  },

  // =========================
  // 🍔 ARTESANAIS (burger)
  // =========================
  {
    id: "peleja",
    name: "Peleja",
    category: "burger",
    price: 26.0,
    description:
      "Pão, hambúrguer artesanal, filé de frango, bacon, milho, batata palha.",
    tags: ["Artesanal", "Molho Verde"],
  },
  {
    id: "tudibom",
    name: "Tudibom",
    category: "burger",
    price: 28.5,
    description:
      "Pão, 2 hambúrgueres artesanais, 2 filés de frango, bacon, milho.",
    tags: ["Artesanal", "Molho Verde"],
  },
  {
    id: "custoso",
    name: "Custoso",
    category: "burger",
    price: 31.0,
    description:
      "Pão, 2 hambúrgueres artesanais, 2 filés de frango, bacon, milho.",
    tags: ["Artesanal", "Molho Verde"],
  },

  // =========================
  // 🌭 HOT DOGS (hotdog)
  // =========================
  {
    id: "nigucim",
    name: "Nigucim",
    category: "hotdog",
    price: 10.0,
    description:
      "Pão, molho, salsicha (Sadia/Perdigão), milho, batata palha, ketchup e maionese. Acompanha ketchup sachê.",
    tags: ["Hot Dog", "Molho Verde"],
  },
  {
    id: "simprao",
    name: "Simprão",
    category: "hotdog",
    price: 12.0,
    description:
      "Pão, molho, salsicha (Sadia/Perdigão), milho, batata palha, bacon, ketchup e maionese. Acompanha ketchup sachê.",
    tags: ["Hot Dog", "Molho Verde"],
  },
  {
    id: "nimin",
    name: "Nimin",
    category: "hotdog",
    price: 13.0,
    description:
      "Pão, molho, 2 salsichas (Sadia/Perdigão), milho, batata palha, bacon, vinagrete, ketchup e maionese. Acompanha ketchup sachê.",
    tags: ["Hot Dog", "Molho Verde"],
  },
  {
    id: "padana",
    name: "Padaná",
    category: "hotdog",
    price: 15.0,
    description:
      "Pão, molho, 2 salsichas (Sadia/Perdigão), milho, batata palha, bacon, vinagrete, mussarela, ketchup e maionese. Acompanha ketchup sachê.",
    tags: ["Hot Dog", "Molho Verde"],
  },
  {
    id: "purizin",
    name: "Purizin",
    category: "hotdog",
    price: 14.0,
    description:
      "Pão, molho, milho, purê de batata cremoso, 1 salsicha, batata palha, ketchup e maionese. Acompanha ketchup sachê.",
    tags: ["Hot Dog", "Molho Verde", "Com Purê"],
  },
  {
    id: "trembao",
    name: "Trembão",
    category: "hotdog",
    price: 17.0,
    description:
      "Pão, molho, milho, purê de batata cremoso, 2 salsichas, bacon crocante, mussarela, batata palha, vinagrete, ketchup e maionese. Acompanha ketchup sachê.",
    tags: ["Hot Dog", "Molho Verde", "Com Purê"],
  },

  // =========================
  // 🥤 BEBIDAS (drink)
  // =========================
  {
    id: "coca-200ml",
    name: "Coca-Cola 200ml",
    category: "drink",
    price: 4.0,
    description: "",
    tags: ["Bebida"],
  },
  {
    id: "del-valle-uva-450ml",
    name: "Del Valle Uva 450ml",
    category: "drink",
    price: 5.0,
    description: "",
    tags: ["Bebida"],
  },
  {
    id: "del-valle-laranja-450ml",
    name: "Del Valle Laranja 450ml",
    category: "drink",
    price: 5.0,
    description: "",
    tags: ["Bebida"],
  },
  {
    id: "coca-310ml",
    name: "Coca-Cola 310ml",
    category: "drink",
    price: 5.5,
    description: "",
    tags: ["Bebida"],
  },
  {
    id: "coca-310ml-zero",
    name: "Coca-Cola 310ml Zero",
    category: "drink",
    price: 5.5,
    description: "",
    tags: ["Bebida", "Zero"],
  },
  {
    id: "fanta-1l",
    name: "Fanta 1L",
    category: "drink",
    price: 8.0,
    description: "",
    tags: ["Bebida"],
  },
  {
    id: "coca-1l",
    name: "Coca-Cola 1L",
    category: "drink",
    price: 9.0,
    description: "",
    tags: ["Bebida"],
  },
  {
    id: "coca-1l-zero",
    name: "Coca-Cola 1L Zero",
    category: "drink",
    price: 9.0,
    description: "",
    tags: ["Bebida", "Zero"],
  },
  {
    id: "kuat-2l",
    name: "Kuat Guaraná 2L",
    category: "drink",
    price: 10.0,
    description: "",
    tags: ["Bebida"],
  },
  {
    id: "coca-2l",
    name: "Coca-Cola 2L",
    category: "drink",
    price: 13.0,
    description: "",
    tags: ["Bebida"],
  },

  // =========================
  // ✅ PROMOÇÕES (DFL)
  // =========================
  {
    id: "promo-001",
    name: "2 UAI + 1 COCA 600ml (Especial 4 Anos)",
    price: 29.99,
    oldPrice: 35.0,
    image: "promocoes/promo10.png",
    description:
      "2 Burgers 'Uai' completinhos (com aquele molho verde!) + 1 Coca-Cola 600ml geladinha!",
    category: "promo",
    tags: ["promo", "uai", "coca", "aniversario", "combo", "desconto"],
  },
  {
    id: "promo-002",
    name: "5 Uai + 1 Kuat 2L (Brinde)",
    price: 64.99,
    oldPrice: 75.0,
    image: "promocoes/promo9.jpg",
    description: "Compre 5 Burgers Uai e leve 1 Kuat 2L por nossa conta! 🎁",
    category: "promo",
    tags: ["promo", "uai", "kuat", "brinde", "familia", "desconto"],
  },
  {
    id: "promo-003",
    name: "4 Armaria",
    price: 59.99,
    oldPrice: 72.0,
    image: "promocoes/promo8.jpg",
    description: "A queridinha da galera! 4 Armaria no super desconto.",
    category: "promo",
    tags: ["promo", "armaria", "familia", "burger", "desconto"],
  },
  {
    id: "promo-004",
    name: "5 Burgers Uai",
    price: 54.0,
    oldPrice: 65.0,
    image: "promocoes/promo6.jpg",
    description: "Pra família toda! 5 Burgers UAI recheados no precinho!",
    category: "promo",
    tags: ["promo", "uai", "familia", "burger", "desconto"],
  },
  {
    id: "promo-005",
    name: "4 Trem + 1 Fanta 1L",
    price: 49.99,
    oldPrice: 65.0,
    image: "promocoes/promo5.jpg",
    description: "O clássico da família! 4 Burgers Trem + Fanta 1L.",
    category: "promo",
    tags: ["promo", "trem", "fanta", "combo", "burger", "desconto"],
  },
  {
    id: "promo-006",
    name: "3 Trem + 1 Fanta 1L",
    price: 44.99,
    oldPrice: 51.0,
    image: "promocoes/promo4.jpg",
    description: "3 Burgers Trem com bacon, queijo e batata palha + 1 Fanta 1L.",
    category: "promo",
    tags: ["promo", "trem", "fanta", "combo", "burger", "desconto"],
  },
  {
    id: "promo-007",
    name: "4 TremBão + 1 Fanta 1L",
    price: 59.99,
    oldPrice: 77.0,
    image: "promocoes/promo7.jpg",
    description:
      "O maior hot dog da casa! 4 TremBão com purê cremoso + Fanta 1L.",
    category: "promo",
    tags: ["promo", "trembao", "fanta", "hotdog", "pure", "combo", "desconto"],
  },
  {
    id: "promo-008",
    name: "2 Burgers Peleja",
    price: 39.99,
    oldPrice: 52.0,
    image: "promocoes/promo3.jpg",
    description:
      "Bora artesanar o bolso! Dois Burgers artesanais 'Peleja' no precinho!",
    category: "promo",
    tags: ["promo", "peleja", "artesanal", "burger", "casal", "desconto"],
  },
  {
    id: "promo-009",
    name: "3 Hot Dog Padaná",
    price: 37.99,
    oldPrice: 45.0,
    image: "promocoes/promo2.jpg",
    description: "3 Padaná completos, perfeitos pra dividir com a galera!",
    category: "promo",
    tags: ["promo", "padana", "hotdog", "familia", "desconto"],
  },
  {
    id: "promo-010",
    name: "2 Purizin + 1 Fanta 1L",
    price: 34.99,
    oldPrice: 40.0,
    image: "promocoes/promo1.jpg",
    description:
      "2 Hot Dogs 'Purizin' com purê cremoso + 1 Fanta 1L geladinha!",
    category: "promo",
    tags: ["promo", "purizin", "fanta", "hotdog", "pure", "combo", "desconto"],
  },
];