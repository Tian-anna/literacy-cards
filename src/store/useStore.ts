import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { CardImage, Scene, PlacedCard } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { get, set, del } from "idb-keyval";

// ==================== idb-keyval 存储 ====================
const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const value = await get(name);
      if (value === undefined || value === null) return null;
      if (typeof value === "string") return value;
      return JSON.stringify(value);
    } catch (e) {
      console.error("[IDB] getItem 失败:", e);
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await set(name, value);
    } catch (e) {
      console.error("[IDB] setItem 失败:", e);
    }
  },
  removeItem: async (name) => {
    try {
      await del(name);
    } catch (e) {
      console.error("[IDB] removeItem 失败:", e);
    }
  },
};

// 调试工具
export const checkStorage = async () => {
  try {
    const value = await get("literacy-card-storage");
    console.log("[Store] 原始存储内容:", typeof value);
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        console.log(
          "[Store] 解析后 state 键:",
          Object.keys(parsed.state || {}),
        );
        console.log("[Store] images 数量:", parsed.state?.images?.length || 0);
      } catch (e) {
        console.log("[Store] 不是有效 JSON");
      }
    } else if (value && typeof value === "object") {
      console.log(
        "[Store] 是对象，images 数量:",
        value.state?.images?.length || 0,
      );
    } else {
      console.log("[Store] 存储为空");
    }
  } catch (e) {
    console.error("[Store] 检查失败:", e);
  }
};

// ==================== Store 接口 ====================
interface StoreState {
  images: CardImage[];
  addImage: (image: Omit<CardImage, "id" | "createdAt">) => void;
  removeImage: (id: string) => void;

  scenes: Scene[];
  currentSceneId: string | null;
  createScene: (name: string) => string;
  loadScene: (id: string) => void;
  deleteScene: (id: string) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;

  placedCards: PlacedCard[];
  addCardToScene: (imageId: string, x?: number, y?: number) => void;
  updateCard: (instanceId: string, updates: Partial<PlacedCard>) => void;
  removeCard: (instanceId: string) => void;
  bringToFront: (instanceId: string) => void;

  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  toggleSelect: (id: string) => void;
  selectOne: (id: string) => void;
  selectRange: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;

  gridSize: number;
  setGridSize: (size: number) => void;
  snapToGrid: boolean;
  setSnapToGrid: (snap: boolean) => void;

  history: PlacedCard[][];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;

  clipboard: PlacedCard[];
  copy: () => void;
  paste: () => void;

  showGrid: boolean;
  setShowGrid: (show: boolean) => void;
  clearCanvas: () => void;

  canvasColor: string;
  setCanvasColor: (color: string) => void;

  exportScene: () => string;
  importScene: (json: string) => void;

  categories: string[];
  addCategory: (category: string) => void;
  removeCategory: (category: string) => void;
  updateImageCategory: (id: string, category: string) => void;

  cleanInvalidImages: () => Promise<void>;
  cleanDuplicateImages: () => void;

  _hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      images: [],
      scenes: [],
      currentSceneId: null,
      placedCards: [],

      selectedIds: new Set<string>(),
      setSelectedIds: (ids) => set({ selectedIds: new Set(ids) }),

      toggleSelect: (id) =>
        set((state: StoreState) => {
          const newSet = new Set(state.selectedIds);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return { selectedIds: newSet };
        }),

      selectOne: (id) => set({ selectedIds: new Set(id ? [id] : []) }),

      selectRange: (id) =>
        set((state: StoreState) => {
          const cards = state.placedCards;
          if (cards.length === 0) return state;

          const selectedArray = Array.from(state.selectedIds);
          let anchorId = selectedArray[selectedArray.length - 1];

          if (!anchorId) {
            return { selectedIds: new Set([id]) };
          }

          const anchorIndex = cards.findIndex((c) => c.instanceId === anchorId);
          const targetIndex = cards.findIndex((c) => c.instanceId === id);

          if (anchorIndex === -1 || targetIndex === -1) {
            return { selectedIds: new Set([id]) };
          }

          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);

          const newSet = new Set(state.selectedIds);
          for (let i = start; i <= end; i++) {
            newSet.add(cards[i].instanceId);
          }

          return { selectedIds: newSet };
        }),

      clearSelection: () => set({ selectedIds: new Set<string>() }),

      selectAll: () =>
        set((state: StoreState) => ({
          selectedIds: new Set(state.placedCards.map((c) => c.instanceId)),
        })),

      isDragging: false,
      gridSize: 40,
      snapToGrid: true,
      history: [[]],
      historyIndex: 0,
      canUndo: false,
      canRedo: false,
      clipboard: [],
      showGrid: true,
      setShowGrid: (show) => set({ showGrid: show }),
      canvasColor: "#e8e8e8",
      setCanvasColor: (color) => set({ canvasColor: color }),
      clearCanvas: () => {
        set({ placedCards: [], selectedIds: new Set<string>() });
        get().saveHistory();
      },

      categories: ["中文", "英文", "未分类"],

      addCategory: (category) =>
        set((state: StoreState) => {
          if (state.categories.includes(category)) return state;
          return { categories: [...state.categories, category] };
        }),

      removeCategory: (category) =>
        set((state: StoreState) => ({
          categories: state.categories.filter((c) => c !== category),
          images: state.images.map((img) =>
            img.category === category ? { ...img, category: "未分类" } : img,
          ),
        })),

      updateImageCategory: (id, category) =>
        set((state: StoreState) => ({
          images: state.images.map((img) =>
            img.id === id ? { ...img, category } : img,
          ),
        })),

      addImage: (image) => {
        set((state: StoreState) => {
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
                category: image.category || "未分类",
              } as CardImage,
            ],
          };
        });
      },

      removeImage: (id) =>
        set((state: StoreState) => ({
          images: state.images.filter((img) => img.id !== id),
          placedCards: state.placedCards.filter((card) => card.imageId !== id),
        })),

      createScene: (name) => {
        const id = uuidv4();
        const newScene: Scene = {
          id,
          name,
          cards: [],
          backgroundColor: "#F3F4F6",
          gridSize: 40,
          snapToGrid: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state: StoreState) => ({
          scenes: [...state.scenes, newScene],
          currentSceneId: id,
          placedCards: [],
          history: [[]],
          historyIndex: 0,
          selectedIds: new Set<string>(),
        }));
        return id;
      },

      loadScene: (id) => {
        const scene = get().scenes.find((s) => s.id === id);
        if (scene) {
          set({
            currentSceneId: id,
            placedCards: scene.cards,
            gridSize: scene.gridSize,
            snapToGrid: scene.snapToGrid,
            history: [scene.cards],
            historyIndex: 0,
            selectedIds: new Set<string>(),
          });
        }
      },

      deleteScene: (id) =>
        set((state: StoreState) => ({
          scenes: state.scenes.filter((s) => s.id !== id),
          currentSceneId:
            state.currentSceneId === id ? null : state.currentSceneId,
        })),

      updateScene: (id, updates) =>
        set((state: StoreState) => ({
          scenes: state.scenes.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s,
          ),
        })),

      addCardToScene: (imageId, x = 100, y = 100) => {
        let sceneId = get().currentSceneId;
        if (!sceneId) {
          sceneId = get().createScene("默认场景");
        }
        const currentState = get();
        const maxZ = Math.max(
          0,
          ...currentState.placedCards.map((c) => c.zIndex),
        );
        const newCard: PlacedCard = {
          instanceId: uuidv4(),
          imageId,
          x: x,
          y: y,
          rotation: 0,
          scale: 1,
          zIndex: maxZ + 1,
        };
        set((prevState: StoreState) => ({
          placedCards: [...prevState.placedCards, newCard],
          selectedIds: new Set([newCard.instanceId]),
        }));
        get().saveHistory();
      },

      updateCard: (instanceId, updates) => {
        set((state: StoreState) => ({
          placedCards: state.placedCards.map((card) =>
            card.instanceId === instanceId ? { ...card, ...updates } : card,
          ),
        }));
      },

      removeCard: (instanceId) => {
        set((state: StoreState) => ({
          placedCards: state.placedCards.filter(
            (c) => c.instanceId !== instanceId,
          ),
          selectedIds: (() => {
            const newSet = new Set(state.selectedIds);
            newSet.delete(instanceId);
            return newSet;
          })(),
        }));
        get().saveHistory();
      },

      bringToFront: (instanceId) => {
        const maxZ = Math.max(0, ...get().placedCards.map((c) => c.zIndex));
        get().updateCard(instanceId, { zIndex: maxZ + 1 });
      },

      setIsDragging: (dragging) => set({ isDragging: dragging }),
      setGridSize: (size) => set({ gridSize: size }),
      setSnapToGrid: (snap) => set({ snapToGrid: snap }),

      saveHistory: () =>
        set((state: StoreState) => {
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push([...state.placedCards]);
          return {
            history: newHistory.slice(-50),
            historyIndex: newHistory.length - 1,
            canUndo: newHistory.length > 1,
            canRedo: false,
          };
        }),

      undo: () =>
        set((state: StoreState) => {
          if (state.historyIndex <= 0) return state;
          const newIndex = state.historyIndex - 1;
          return {
            placedCards: [...state.history[newIndex]],
            historyIndex: newIndex,
            canUndo: newIndex > 0,
            canRedo: true,
            selectedIds: new Set<string>(),
          };
        }),

      redo: () =>
        set((state: StoreState) => {
          if (state.historyIndex >= state.history.length - 1) return state;
          const newIndex = state.historyIndex + 1;
          return {
            placedCards: [...state.history[newIndex]],
            historyIndex: newIndex,
            canUndo: true,
            canRedo: newIndex < state.history.length - 1,
            selectedIds: new Set<string>(),
          };
        }),

      copy: () =>
        set((state: StoreState) => ({
          clipboard: state.placedCards.filter((c) =>
            state.selectedIds.has(c.instanceId),
          ),
        })),

      paste: () =>
        set((state: StoreState) => {
          if (state.clipboard.length === 0) return state;
          const maxZ = Math.max(0, ...state.placedCards.map((c) => c.zIndex));
          const newCards = state.clipboard.map((card, idx) => ({
            ...card,
            instanceId: uuidv4(),
            x: card.x + 30,
            y: card.y + 30,
            zIndex: maxZ + idx + 1,
          }));
          return {
            placedCards: [...state.placedCards, ...newCards],
            selectedIds: new Set(newCards.map((c) => c.instanceId)),
          };
        }),

      exportScene: () => {
        const state = get();
        const scene = state.scenes.find((s) => s.id === state.currentSceneId);
        if (!scene) return "";
        return JSON.stringify(
          {
            ...scene,
            cards: state.placedCards,
            exportedAt: Date.now(),
          },
          null,
          2,
        );
      },

      importScene: (json) => {
        try {
          const data = JSON.parse(json);
          const id = uuidv4();
          const newScene: Scene = {
            id,
            name: data.name + " (导入)",
            cards: data.cards || [],
            backgroundColor: data.backgroundColor || "#F3F4F6",
            gridSize: data.gridSize || 40,
            snapToGrid: data.snapToGrid ?? true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          set((state: StoreState) => ({
            scenes: [...state.scenes, newScene],
            currentSceneId: id,
            placedCards: newScene.cards,
            selectedIds: new Set<string>(),
          }));
        } catch (e) {
          alert("导入失败：文件格式错误");
        }
      },

      cleanInvalidImages: async () => {
        const state = get();
        const validImages: CardImage[] = [];
        let invalidCount = 0;

        function checkImageUrl(url: string): Promise<boolean> {
          return new Promise((resolve) => {
            const img = new Image();
            const timeout = setTimeout(() => resolve(false), 5000);
            img.onload = () => {
              clearTimeout(timeout);
              resolve(true);
            };
            img.onerror = () => {
              clearTimeout(timeout);
              resolve(false);
            };
            img.src = url;
          });
        }

        for (const image of state.images) {
          try {
            const isValid = await checkImageUrl(image.src);
            if (isValid) {
              validImages.push(image);
            } else {
              invalidCount++;
              console.log("本地 URL 无效，移除:", image.name);
            }
          } catch {
            invalidCount++;
            console.log("本地 URL 无效，移除:", image.name);
          }
        }

        if (invalidCount > 0) {
          console.log("本地清理无效图片:", invalidCount, "张");
        }

        set({ images: validImages });
      },

      cleanDuplicateImages: () => {
        set((state: StoreState) => {
          const seen = new Map<string, CardImage>();
          const duplicates: CardImage[] = [];

          state.images.forEach((img) => {
            if (seen.has(img.name)) {
              duplicates.push(img);
            } else {
              seen.set(img.name, img);
            }
          });

          if (duplicates.length > 0) {
            console.log(
              "清理重复图片:",
              duplicates.length,
              "张（仅本地，不删 GitHub）",
            );
          }

          return {
            images: state.images.filter((img) => !duplicates.includes(img)),
          };
        });
      },

      _hasHydrated: false,
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),
    }),
    {
      name: "literacy-card-storage",
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        images: state.images,
        scenes: state.scenes,
        currentSceneId: state.currentSceneId,
        canvasColor: state.canvasColor,
        showGrid: state.showGrid,
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid,
        categories: state.categories,
        _hasHydrated: state._hasHydrated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("[Store] 持久化恢复失败:", error);
        } else if (state) {
          console.log(
            "[Store] 持久化恢复成功，图片数量:",
            state.images?.length || 0,
          );
        } else {
          console.log("[Store] 持久化恢复: 无先前数据");
        }
      },
    },
  ),
);

// 延迟设置 hydration 完成
if (typeof window !== "undefined") {
  setTimeout(() => {
    const store = useStore.getState();
    store.setHasHydrated(true);
    console.log("[Store] hydration 完成，当前图片:", store.images.length);
  }, 500);
}
