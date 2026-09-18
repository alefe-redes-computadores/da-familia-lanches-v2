// ARQUIVO DE DADOS DOS PRODUTOS 📝
// DICA: Para pausar um produto (Esgotado), mude disponivel para: false

export type ProductCategory = string;

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number; // <--- PREÇO ORIGINAL PARA EXIBIR DESCONTO
  image: string;
  category: ProductCategory;
  disponivel: boolean;
  isSuggestion?: boolean;
  promoPlacement?: "home_showcase" | "none";
  sortOrder?: number;
  addonIds?: string[];
  detailsTitle?: string;
  detailsItems?: string[];
  includedExtras?: string;
  bundleItems?: Array<{ productId: string; quantity: number; note?: string }>;
};

export const products: Product[] = [

  {
    id: "combo-7-uai",
    name: "Combo 7 Uai",
    description: "Sete Uai caprichados para reunir a família e dividir com a turma, com preço especial.",
    price: 69.99,
    oldPrice: 90.00,
    image: "/img/uai.png",
    category: "promocoes",
    disponivel: true,
    isSuggestion: false,
    promoPlacement: "home_showcase",
    sortOrder: 6,
    detailsTitle: "O que vem no Combo 7 Uai?",
    detailsItems: [
      "7 lanches Uai",
    ],
    includedExtras: "Acompanha ketchup e molho verde da casa.",
    bundleItems: [
      { productId: "uai", quantity: 7 },
    ],
  },


  // ==========================================================
  // V35.1 — OFERTAS DA FAMÍLIA
  // Imagens temporárias: produto-base.
  // As artes oficiais podem ser enviadas posteriormente no Admin.
  // ==========================================================

  {
    id: "combo-familia-uai",
    name: "Combo Família Uai",
    description: "Pra reunir a família: 5 Uai caprichados + 1 Kuat 2L por um preço especial.",
    price: 59.99,
    oldPrice: 82.00,
    image: "/img/uai.png",
    category: "promocoes",
    disponivel: true,
    isSuggestion: false,
    promoPlacement: "home_showcase",
    sortOrder: 1,
    detailsTitle: "O que vem no Combo Família Uai?",
    detailsItems: [
      "5 lanches Uai",
      "1 Kuat 2L",
    ],
    includedExtras: "Acompanha molho verde da casa.",
    bundleItems: [
      { productId: "uai", quantity: 5 },
    ],
  },

  {
    id: "combo-bitela-oferta",
    name: "Combo Bitela",
    description: "Quatro Bitelas gigantes e bem recheados + 1 Kuat 2L para dividir com a galera.",
    price: 72.99,
    oldPrice: 105.00,
    image: "/img/bitela.png",
    category: "promocoes",
    disponivel: true,
    isSuggestion: false,
    promoPlacement: "home_showcase",
    sortOrder: 2,
    detailsTitle: "O que vem no Combo Bitela?",
    detailsItems: [
      "4 lanches Bitela",
      "1 Kuat 2L",
    ],
    includedExtras: "Acompanha molho verde da casa.",
    bundleItems: [
      { productId: "bitela", quantity: 4 },
    ],
  },

  {
    id: "combo-apruma-oferta",
    name: "Combo Apruma",
    description: "Quatro Apruma completos + 1 Fanta 1L, num combo reforçado para compartilhar.",
    price: 79.98,
    oldPrice: 110.00,
    image: "/img/apruma.png",
    category: "promocoes",
    disponivel: true,
    isSuggestion: false,
    promoPlacement: "home_showcase",
    sortOrder: 3,
    detailsTitle: "O que vem no Combo Apruma?",
    detailsItems: [
      "4 lanches Apruma",
      "1 Fanta 1L",
    ],
    includedExtras: "Acompanha molho verde da casa.",
    bundleItems: [
      { productId: "apruma", quantity: 4 },
    ],
  },

  {
    id: "combo-4-uai",
    name: "Combo 4 Uai",
    description: "Quatro Uai caprichados para dividir, com preço especial.",
    price: 41.99,
    oldPrice: 52.00,
    image: "/img/uai.png",
    category: "promocoes",
    disponivel: true,
    isSuggestion: false,
    promoPlacement: "home_showcase",
    sortOrder: 4,
    detailsTitle: "O que vem no Combo 4 Uai?",
    detailsItems: [
      "4 lanches Uai",
    ],
    includedExtras: "Acompanha ketchup e molho verde da casa.",
    bundleItems: [
      { productId: "uai", quantity: 4 },
    ],
  },

  {
    id: "combo-armaria-oferta",
    name: "Combo Armaria",
    description: "Quatro Armaria reforçados + 1 Kuat 2L, num combo completo para compartilhar.",
    price: 67.99,
    oldPrice: 86.00,
    image: "/img/armaria.png",
    category: "promocoes",
    disponivel: true,
    isSuggestion: false,
    promoPlacement: "home_showcase",
    sortOrder: 5,
    detailsTitle: "O que vem no Combo Armaria?",
    detailsItems: [
      "4 lanches Armaria",
      "1 Kuat 2L",
    ],
    includedExtras: "Acompanha molho verde da casa.",
    bundleItems: [
      { productId: "armaria", quantity: 4 },
    ],
  },

  // =========================================
  // 🔥 PROMOÇÕES
  // =========================================

  // --- NOVAS PROMOÇÕES (EM DESTAQUE) ---

  // --- PROMOÇÕES EXISTENTES ---
  {
    id: "promo-1",
    name: "2 UAI + 1 COCA 600ml",
    description: "Especial 4 Anos! 2 Burgers 'Uai' completinhos + Coca 600ml geladinha.",
    price: 29.99,
    image: "/img/promo10.png",
    category: "promocoes",
    disponivel: false,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["2 Burgers Uai", "1 Coca-Cola 600ml"],
    includedExtras: 'Os Burgers Uai acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "promo-2",
    name: "5 Uai + 1 Kuat 2L (Brinde)",
    description: "Compre 5 Burgers Uai e leve 1 Kuat 2L por nossa conta! 🎁",
    price: 64.99,
    image: "/img/promo9.jpg",
    category: "promocoes",
    disponivel: true,
    isSuggestion: true,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["5 Burgers Uai", "1 Kuat 2L (brinde)"],
    includedExtras: 'Os Burgers Uai acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "promo-3",
    name: "4 Armaria",
    description: "A queridinha da galera! 4 Burgers Armaria no super desconto.",
    price: 59.99,
    image: "/img/promo8.jpg",
    category: "promocoes",
    disponivel: true,
    isSuggestion: true,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["4 Burgers Armaria"],
    includedExtras: 'Os Burgers Armaria acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "promo-4",
    name: "5 Burgers Uai",
    description: "Pra família toda! 5 Burgers UAI recheados no precinho!",
    price: 54.00,
    image: "/img/promo6.jpg",
    category: "promocoes",
    disponivel: false,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["5 Burgers Uai"],
    includedExtras: 'Os Burgers Uai acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "promo-5",
    name: "4 Trem + 1 Fanta 1L",
    description: "O clássico da família! 4 Burgers Trem + Fanta 1L.",
    price: 49.99,
    image: "/img/promo5.jpg",
    category: "promocoes",
    disponivel: false,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["4 Burgers Trem", "1 Fanta 1L"],
    includedExtras: 'Os Burgers Trem acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "promo-6",
    name: "3 Trem + 1 Fanta 1L",
    description: "3 Burgers Trem + 1 Fanta 1L.",
    price: 44.99,
    image: "/img/promo4.jpg",
    category: "promocoes",
    disponivel: true,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["3 Burgers Trem", "1 Fanta 1L"],
    includedExtras: 'Os Burgers Trem acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "promo-7",
    name: "4 TremBão + 1 Fanta 1L",
    description: "O maior hot dog da casa! 4 TremBão com purê cremoso + Fanta 1L.",
    price: 59.99,
    image: "/img/promo7.jpg",
    category: "promocoes",
    disponivel: false,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["4 TremBão", "1 Fanta 1L"]
  },
  {
    id: "promo-8",
    name: "2 Burgers Peleja",
    description: "Bora artesanar o bolso! Dois Burgers artesanais 'Peleja' no precinho!",
    price: 39.99,
    image: "/img/promo3.jpg",
    category: "promocoes",
    disponivel: false,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["2 Burgers Peleja"],
    includedExtras: 'Os Burgers Peleja acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "promo-9",
    name: "3 Hot Dog Padaná",
    description: "3 Padaná completos, perfeitos pra dividir com a galera!",
    price: 37.99,
    image: "/img/promo2.jpg",
    category: "promocoes",
    disponivel: false,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["3 Hot Dogs Padaná"]
  },
  {
    id: "promo-10",
    name: "2 Purizin + 1 Fanta 1L",
    description: "2 Hot Dogs 'Purizin' com purê cremoso + 1 Fanta 1L geladinha!",
    price: 34.99,
    image: "/img/promo1.jpg",
    category: "promocoes",
    disponivel: false,
    detailsTitle: 'O que vem nesta promoção?',
    detailsItems: ["2 Hot Dogs Purizin", "1 Fanta 1L"]
  },

  // =========================================
  // 🧡 COMBOS
  // =========================================
  {
    id: "combo-casal-trad",
    name: "Combo Casal Tradicional",
    description: "2 Burger Trem + 1 Fanta 1L.",
    price: 34.99,
    image: "/img/combo1.png",
    category: "combos",
    disponivel: true,
    isSuggestion: true,
    detailsTitle: 'O que vem no Combo Casal Tradicional?',
    detailsItems: ["2 Burgers Trem", "1 Fanta 1L"],
    includedExtras: 'Os Burgers Trem acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "combo-casal-art",
    name: "Combo Casal Artesanal",
    description: "2 Burger Peleja + 1 Fanta 1L.",
    price: 49.99,
    image: "/img/combo2.png",
    category: "combos",
    disponivel: true,
    isSuggestion: true,
    detailsTitle: 'O que vem no Combo Casal Artesanal?',
    detailsItems: ["2 Burgers Peleja", "1 Fanta 1L"],
    includedExtras: 'Os Burgers Peleja acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "combo-familia-trad",
    name: "Combo Família Tradicional",
    description: "4 Burger Trem + 1 Kuat 2L.",
    price: 59.99,
    image: "/img/combo3.png",
    category: "combos",
    disponivel: true,
    isSuggestion: true,
    detailsTitle: 'O que vem no Combo Família Tradicional?',
    detailsItems: ["4 Burgers Trem", "1 Kuat 2L"],
    includedExtras: 'Os Burgers Trem acompanham molho verde da casa e ketchup em sachê.'
  },
  {
    id: "combo-familia-art",
    name: "Combo Família Artesanal",
    description: "4 Burger Peleja + 1 Kuat 2L.",
    price: 84.99,
    image: "/img/combo4.png",
    category: "combos",
    disponivel: true,
    isSuggestion: true,
    detailsTitle: 'O que vem no Combo Família Artesanal?',
    detailsItems: ["4 Burgers Peleja", "1 Kuat 2L"],
    includedExtras: 'Os Burgers Peleja acompanham molho verde da casa e ketchup em sachê.'
  },

  // =========================================
  // 🍔 TRADICIONAIS
  // =========================================
  {
    id: "bao",
    name: "Bão",
    description: "Pão, hambúrguer, alface, tomate, presunto e mussarela. Acompanha ketchup sachê.",
    price: 11.00,
    image: "/img/bao.png",
    category: "tradicionais",
    disponivel: true
  },
  {
    id: "uai",
    name: "Uai",
    description: "Pão, hambúrguer, milho, bacon, alface, tomate, presunto e mussarela.",
    price: 13.00,
    image: "/img/uai.png",
    category: "tradicionais",
    disponivel: true,

    detailsTitle: "O que vem no Uai?",

    detailsItems: ["Pão", "Hambúrguer", "Milho", "Bacon", "Alface", "Tomate", "Presunto", "Mussarela"],

    includedExtras: "Nossa maionese temperada — o famoso molho verde da casa — e ketchup em sachê.",
  },
  {
    id: "trem",
    name: "Trem",
    description: "Pão, hambúrguer, salsicha, bacon, milho, alface, tomate, presunto e mussarela.",
    price: 14.00,
    image: "/img/trem.png",
    category: "tradicionais",
    disponivel: true,

    detailsTitle: "O que vem no Trem?",

    detailsItems: ["Pão", "Hambúrguer", "Salsicha", "Bacon", "Milho", "Alface", "Tomate", "Presunto", "Mussarela"],

    includedExtras: "Nossa maionese temperada — o famoso molho verde da casa — e ketchup em sachê.",
  },
  {
    id: "cadim",
    name: "Cadim",
    description: "Pão, hambúrguer, 1 filé frango, bacon, milho, salsicha, alface, tomate, presunto e mussarela.",
    price: 17.00,
    image: "/img/cadim.png",
    category: "tradicionais",
    disponivel: true
  },
  {
    id: "armaria",
    name: "Armaria",
    description: "Pão, 1 hambúrguer, 1 filé frango, bacon, milho, batata palha, alface, tomate, salsicha, presunto e mussarela.",
    price: 18.00,
    image: "/img/armaria.png",
    category: "tradicionais",
    disponivel: true,

    detailsTitle: "O que vem no Armaria?",

    detailsItems: ["Pão", "Hambúrguer", "Filé de frango", "Bacon", "Milho", "Batata palha", "Alface", "Tomate", "Salsicha", "Presunto", "Mussarela"],

    includedExtras: "Nossa maionese temperada — o famoso molho verde da casa — e ketchup em sachê.",
  },
  {
    id: "bitela",
    name: "Bitela",
    description: "Pão, 2 hambúrgueres, filé frango, bacon, milho, batata palha, alface, salsicha, tomate, presunto e mussarela.",
    price: 22.00,
    image: "/img/bitela.png",
    category: "tradicionais",
    disponivel: true,

    detailsTitle: "O que vem no Bitela?",

    detailsItems: ["Pão", "2 hambúrgueres", "Filé de frango", "Bacon", "Milho", "Batata palha", "Alface", "Salsicha", "Tomate", "Presunto", "Mussarela"],

    includedExtras: "Nossa maionese temperada — o famoso molho verde da casa — e ketchup em sachê.",
  },
  {
    id: "apruma",
    name: "Apruma",
    description: "Pão, 3 hambúrgueres, filé frango, bacon, salsicha, milho, batata palha, alface, tomate, 2 presuntos e 2 mussarelas.",
    price: 25.00,
    image: "/img/apruma.png",
    category: "tradicionais",
    disponivel: true,

    detailsTitle: "O que vem no Apruma?",

    detailsItems: ["Pão", "3 hambúrgueres", "Filé de frango", "Bacon", "Salsicha", "Milho", "Batata palha", "Alface", "Tomate", "2 presuntos", "2 mussarelas"],

    includedExtras: "Nossa maionese temperada — o famoso molho verde da casa — e ketchup em sachê.",
  },

  // =========================================
  // 🍔 ARTESANAIS
  // =========================================
  {
    id: "peleja",
    name: "Peleja",
    description: "Pão, hambúrguer artesanal, filé de frango, bacon, milho, batata palha.",
    price: 26.00,
    image: "/img/peleja.png",
    category: "artesanais",
    disponivel: true,

    detailsTitle: "O que vem no Peleja?",

    detailsItems: ["Pão", "Hambúrguer artesanal", "Filé de frango", "Bacon", "Milho", "Batata palha"],

    includedExtras: "Nossa maionese temperada — o famoso molho verde da casa — e ketchup em sachê.",
  },
  {
    id: "tudibom",
    name: "Tudibom",
    description: "Pão, 2 hambúrgueres artesanais, 2 filés de frango, bacon, milho.",
    price: 28.50,
    image: "/img/tudibom.png",
    category: "artesanais",
    disponivel: true
  },
  {
    id: "custoso",
    name: "Custoso",
    description: "Pão, 2 hambúrgueres artesanais, 2 filés de frango, bacon, milho.",
    price: 31.00,
    image: "/img/custoso.png",
    category: "artesanais",
    disponivel: true
  },

  // =========================================
  // 🌭 HOT DOGS
  // =========================================
  {
    id: "nigucim",
    name: "Nigucim",
    description: "Pão, molho, salsicha, milho, batata palha, ketchup e maionese.",
    price: 10.00,
    image: "/img/nigucim.png",
    category: "hotdogs",
    disponivel: false
  },
  {
    id: "simprao",
    name: "Simprão",
    description: "Pão, molho, salsicha, milho, batata palha, bacon, ketchup e maionese.",
    price: 12.00,
    image: "/img/simprao.png",
    category: "hotdogs",
    disponivel: false
  },
  {
    id: "nimin",
    name: "Nimin",
    description: "Pão, molho, 2 salsichas, milho, batata palha, bacon, vinagrete, ketchup e maionese.",
    price: 13.00,
    image: "/img/nimin.png",
    category: "hotdogs",
    disponivel: false
  },
  {
    id: "padana",
    name: "Padaná",
    description: "Pão, molho, 2 salsichas, milho, batata palha, bacon, vinagrete, mussarela, ketchup e maionese.",
    price: 15.00,
    image: "/img/padana.png",
    category: "hotdogs",
    disponivel: false
  },
  {
    id: "purizin",
    name: "Purizin",
    description: "Com Purê! Pão, molho, milho, purê de batata, 1 salsicha, batata palha.",
    price: 14.00,
    image: "/img/purizin.png",
    category: "hotdogs",
    disponivel: false
  },
  {
    id: "trembao",
    name: "Trembão",
    description: "Com Purê! Pão, molho, milho, purê, 2 salsichas, bacon, mussarela, batata palha, vinagrete.",
    price: 17.00,
    image: "/img/trembao.png",
    category: "hotdogs",
    disponivel: false
  },

  // =========================================
  // 🥤 BEBIDAS
  // =========================================
  {
    id: "coca-200",
    name: "Coca-Cola 200ml",
    description: "Garrafinha.",
    price: 4.00,
    image: "/img/coca.png",
    category: "bebidas",
    disponivel: true
  },
  {
    id: "delvalle-uva",
    name: "Del Valle Uva 450ml",
    description: "Suco de Uva.",
    price: 5.00,
    image: "/img/delvalle-uva.png",
    category: "bebidas",
    disponivel: true
  },
  {
    id: "delvalle-laranja",
    name: "Del Valle Laranja 450ml",
    description: "Suco de Laranja.",
    price: 5.00,
    image: "/img/delvalle-laranja.png",
    category: "bebidas",
    disponivel: true
  },
  {
    id: "coca-310",
    name: "Coca-Cola 310ml",
    description: "Lata.",
    price: 5.50,
    image: "/img/coca-lata.png",
    category: "bebidas",
    disponivel: true
  },
  {
    id: "coca-310-zero",
    name: "Coca-Cola 310ml Zero",
    description: "Lata Zero Açúcar.",
    price: 5.50,
    image: "/img/coca-lata-zero.png",
    category: "bebidas",
    disponivel: true
  },
  {
    id: "fanta-1l",
    name: "Fanta 1L",
    description: "Garrafa.",
    price: 8.00,
    image: "/img/fanta.png",
    category: "bebidas",
    disponivel: true,
    isSuggestion: true
  },
  {
    id: "coca-1l",
    name: "Coca-Cola 1L",
    description: "Garrafa.",
    price: 9.00,
    image: "/img/coca-1l.png",
    category: "bebidas",
    disponivel: true,
    isSuggestion: true
  },
  {
    id: "coca-1l-zero",
    name: "Coca-Cola 1L Zero",
    description: "Garrafa Zero.",
    price: 9.00,
    image: "/img/coca-1l-zero.png",
    category: "bebidas",
    disponivel: true
  },
  {
    id: "kuat-2l",
    name: "Kuat Guaraná 2L",
    description: "Garrafa Família.",
    price: 10.00,
    image: "/img/kuat.png",
    category: "bebidas",
    disponivel: true
  },
  {
    id: "coca-2l",
    name: "Coca-Cola 2L",
    description: "Garrafa Família.",
    price: 13.00,
    image: "/img/coca-2l.png",
    category: "bebidas",
    disponivel: true
  }
];
