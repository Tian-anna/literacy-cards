import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Image {
  id: string;
  src: string;
  name: string;
  category: string;
  width: number;
  height: number;
  createdAt?: number;
}

interface Card {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface StoreState {
  images: Image[];
  cards: Card[];
  addImage: (image: Omit<Image, "id" | "createdAt">) => void;
  removeImage: (id: string) => void;
  addCardToScene: (imageId: string) => void;
  removeCard: (id: string) => void;
  updateCard: (id: string, updates: Partial<Card>) => void;
  cleanInvalidImages: () => Promise<void>;
  cleanDuplicateImages: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      images: [],
      cards: [],

      addImage: (image) => {
        set((state) => {
          // 检查是否已存在（通过 src 或 name 判断）
          const exists = state.images.some(
            (img) => img.src === image.src || img.name === image.name,
          );
          if (exists) {
            console.log("图片已存在，跳过:", image.name);
            return state;
          }

          return {
            images: [
              ...state.images,
              {
                ...image,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
              },
            ],
          };
        });
      },

      removeImage: (id) => {
        set((state) => ({
          images: state.images.filter((img) => img.id !== id),
          cards: state.cards.filter((card) => card.imageId !== id),
        }));
      },

      addCardToScene: (imageId) => {
        const image = get().images.find((img) => img.id === imageId);
        if (!image) return;

        set((state) => ({
          cards: [
            ...state.cards,
            {
              id: crypto.randomUUID(),
              imageId,
              x: Math.random() * 200 + 100,
              y: Math.random() * 200 + 100,
              width: image.width * 0.5,
              height: image.height * 0.5,
              rotation: 0,
            },
          ],
        }));
      },

      removeCard: (id) => {
        set((state) => ({
          cards: state.cards.filter((card) => card.id !== id),
        }));
      },

      updateCard: (id, updates) => {
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === id ? { ...card, ...updates } : card,
          ),
        }));
      },

      // 清理无效的图片（URL 失效的）
      cleanInvalidImages: async () => {
        const state = get();
        const validImages: Image[] = [];

        for (const image of state.images) {
          try {
            // 检查 URL 是否有效
            const res = await fetch(image.src, { method: "HEAD" });
            if (res.ok) {
              validImages.push(image);
            } else {
              console.log("删除无效图片:", image.name);
            }
          } catch {
            console.log("删除无效图片:", image.name);
          }
        }

        set({ images: validImages });
      },

      // 清理重复的图片（保留第一个）
      cleanDuplicateImages: () => {
        set((state) => {
          const uniqueImages = new Map<string, Image>();
          const duplicates: string[] = [];

          state.images.forEach((img) => {
            if (uniqueImages.has(img.name)) {
              duplicates.push(img.id);
            } else {
              uniqueImages.set(img.name, img);
            }
          });

          if (duplicates.length > 0) {
            console.log("删除重复图片:", duplicates.length, "张");
          }

          return {
            images: state.images.filter((img) => !duplicates.includes(img.id)),
          };
        });
      },
    }),
    {
      name: "literacy-cards",
      partialize: (state) => ({
        images: state.images,
        cards: state.cards,
      }),
    },
  ),
);
