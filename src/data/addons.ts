export type Addon = {
  id: string;
  name: string;
  price: number;
};

export const ADDONS: Addon[] = [
  { id: "cebola", name: "Cebola", price: 0.99 },
  { id: "salada", name: "Salada", price: 1.99 },
  { id: "ovo", name: "Ovo", price: 1.99 },
  { id: "bacon", name: "Bacon", price: 2.99 },
  { id: "hamburguer-trad", name: "Hambúrguer Tradicional 56g", price: 2.99 },
  { id: "cheddar", name: "Cheddar Cremoso", price: 3.99 },
  { id: "file-frango", name: "Filé de Frango", price: 5.99 },
  { id: "hamburguer-art", name: "Hambúrguer Artesanal 120g", price: 7.99 },
];