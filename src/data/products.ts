// ARQUIVO DE DADOS DOS PRODUTOS 📝
// DICA: Para pausar um produto (Esgotado), mude disponivel para: false

export type ProductCategory = "promocoes" | "combos" | "tradicionais" | "artesanais" | "hotdogs" | "bebidas";

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
  sortOrder?: number;
  addonIds?: string[];
};

export const products: Product[] = [
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
    disponivel: false
  },
  {
    id: "promo-2",
    name: "5 Uai + 1 Kuat 2L (Brinde)",
    description: "Compre 5 Burgers Uai e leve 1 Kuat 2L por nossa conta! 🎁",
    price: 64.99,
    image: "/img/promo9.jpg",
    category: "promocoes",
    disponivel: true,
    isSuggestion: true
  },
  {
    id: "promo-3",
    name: "4 Armaria",
    description: "A queridinha da galera! 4 Burgers Armaria no super desconto.",
    price: 59.99,
    image: "/img/promo8.jpg",
    category: "promocoes",
    disponivel: true,
    isSuggestion: true
  },
  {
    id: "promo-4",
    name: "5 Burgers Uai",
    description: "Pra família toda! 5 Burgers UAI recheados no precinho!",
    price: 54.00,
    image: "/img/promo6.jpg",
    category: "promocoes",
    disponivel: false
  },
  {
    id: "promo-5",
    name: "4 Trem + 1 Fanta 1L",
    description: "O clássico da família! 4 Burgers Trem + Fanta 1L.",
    price: 49.99,
    image: "/img/promo5.jpg",
    category: "promocoes",
    disponivel: false
  },
  {
    id: "promo-6",
    name: "3 Trem + 1 Fanta 1L",
    description: "3 Burgers Trem + 1 Fanta 1L.",
    price: 44.99,
    image: "/img/promo4.jpg",
    category: "promocoes",
    disponivel: true
  },
  {
    id: "promo-7",
    name: "4 TremBão + 1 Fanta 1L",
    description: "O maior hot dog da casa! 4 TremBão com purê cremoso + Fanta 1L.",
    price: 59.99,
    image: "/img/promo7.jpg",
    category: "promocoes",
    disponivel: false
  },
  {
    id: "promo-8",
    name: "2 Burgers Peleja",
    description: "Bora artesanar o bolso! Dois Burgers artesanais 'Peleja' no precinho!",
    price: 39.99,
    image: "/img/promo3.jpg",
    category: "promocoes",
    disponivel: false
  },
  {
    id: "promo-9",
    name: "3 Hot Dog Padaná",
    description: "3 Padaná completos, perfeitos pra dividir com a galera!",
    price: 37.99,
    image: "/img/promo2.jpg",
    category: "promocoes",
    disponivel: false
  },
  {
    id: "promo-10",
    name: "2 Purizin + 1 Fanta 1L",
    description: "2 Hot Dogs 'Purizin' com purê cremoso + 1 Fanta 1L geladinha!",
    price: 34.99,
    image: "/img/promo1.jpg",
    category: "promocoes",
    disponivel: false
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
    isSuggestion: true
  },
  {
    id: "combo-casal-art",
    name: "Combo Casal Artesanal",
    description: "2 Burger Peleja + 1 Fanta 1L.",
    price: 49.99,
    image: "/img/combo2.png",
    category: "combos",
    disponivel: true,
    isSuggestion: true
  },
  {
    id: "combo-familia-trad",
    name: "Combo Família Tradicional",
    description: "4 Burger Trem + 1 Kuat 2L.",
    price: 59.99,
    image: "/img/combo3.png",
    category: "combos",
    disponivel: true,
    isSuggestion: true
  },
  {
    id: "combo-familia-art",
    name: "Combo Família Artesanal",
    description: "4 Burger Peleja + 1 Kuat 2L.",
    price: 84.99,
    image: "/img/combo4.png",
    category: "combos",
    disponivel: true,
    isSuggestion: true
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
    disponivel: true
  },
  {
    id: "trem",
    name: "Trem",
    description: "Pão, hambúrguer, salsicha, bacon, milho, alface, tomate, presunto e mussarela.",
    price: 14.00,
    image: "/img/trem.png",
    category: "tradicionais",
    disponivel: true
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
    disponivel: true
  },
  {
    id: "bitela",
    name: "Bitela",
    description: "Pão, 2 hambúrgueres, filé frango, bacon, milho, batata palha, alface, salsicha, tomate, presunto e mussarela.",
    price: 22.00,
    image: "/img/bitela.png",
    category: "tradicionais",
    disponivel: true
  },
  {
    id: "apruma",
    name: "Apruma",
    description: "Pão, 3 hambúrgueres, filé frango, bacon, salsicha, milho, batata palha, alface, tomate, 2 presuntos e 2 mussarelas.",
    price: 25.00,
    image: "/img/apruma.png",
    category: "tradicionais",
    disponivel: true
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
    disponivel: true
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
