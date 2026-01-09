import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@/data/products";
import { Addon } from "@/data/addons";

// Agora o item do carrinho guarda os Adicionais e Observações
export interface CartItem extends Product {
  cartId: string; // ID único para diferenciar (Ex: X-Bacon com ovo vs X-Bacon normal)
  quantity: number;
  selectedAddons: Addon[];
  observation: string;
}

interface CartState {
  items: CartItem[];
  
  // A função addItem agora recebe opcionais (adicionais e obs)
  addItem: (product: Product, quantity?: number, addons?: Addon[], obs?: string) => void;
  
  removeItem: (cartId: string) => void; // Remove pelo ID único
  increaseQtd: (cartId: string) => void;
  decreaseQtd: (cartId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, addons = [], obs = "") => {
        set((state) => {
          // Preço base + soma dos adicionais
          const addonsTotal = addons.reduce((acc, ad) => acc + ad.price, 0);
          const finalPrice = Number(product.price) + addonsTotal;

          // Cria um ID único baseado nas escolhas (Garante que itens iguais se juntem, mas diferentes fiquem separados)
          // Ex: "uai-bacon-ovo-semcebola"
          const addonsId = addons.map(a => a.id).sort().join("-");
          const uniqueId = `${product.id}|${addonsId}|${obs.trim()}`;

          const existingItem = state.items.find((i) => i.cartId === uniqueId);

          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.cartId === uniqueId 
                  ? { ...i, quantity: i.quantity + quantity } 
                  : i
              ),
            };
          }

          return {
            items: [
              ...state.items,
              { 
                ...product, 
                cartId: uniqueId, // O segredo está aqui
                quantity: quantity, 
                price: finalPrice, // O preço salvo já é o (Unitário + Adicionais)
                selectedAddons: addons,
                observation: obs
              },
            ],
          };
        });
      },

      removeItem: (cartId) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartId !== cartId),
        })),

      increaseQtd: (cartId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i
          ),
        })),

      decreaseQtd: (cartId) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.cartId === cartId ? { ...i, quantity: i.quantity - 1 } : i
            )
            .filter((i) => i.quantity > 0),
        })),

      clearCart: () => set({ items: [] }),

      getCartTotal: () => {
        return get().items.reduce((total, item) => {
          return total + (item.price * item.quantity);
        }, 0);
      },
    }),
    {
      name: "dfl-cart-storage",
    }
  )
);