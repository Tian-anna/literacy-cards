import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CardImage, Scene, PlacedCard } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { get, set, del } from "idb-keyval";

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

  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
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
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      images: [],
      scenes: [],
      currentSceneId: null,
      placedCards: [],
      selectedId: null,
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
        set({ placedCards: [], selectedId: null });
        get().saveHistory();
      },

      addImage: (image) =>
        set((state) => ({
          images: [
            ...state.images,
            { ...image, id: uuidv4(), createdAt: Date.now() },
          ],
        })),

      removeImage: (id) =>
        set((state) => ({
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
        set((state) => ({
          scenes: [...state.scenes, newScene],
          currentSceneId: id,
          placedCards: [],
          history: [[]],
          historyIndex: 0,
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
          });
        }
      },

      deleteScene: (id) =>
        set((state) => ({
          scenes: state.scenes.filter((s) => s.id !== id),
          currentSceneId:
            state.currentSceneId === id ? null : state.currentSceneId,
        })),

      updateScene: (id, updates) =>
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s,
          ),
        })),

      addCardToScene: (imageId, x = 100, y = 100) => {
        // 如果没有场景，先创建场景
        let sceneId = get().currentSceneId;
        if (!sceneId) {
          sceneId = get().createScene("默认场景");
        }

        // 重新获取最新状态（确保场景已创建）
        const currentState = get();
        const maxZ = Math.max(
          0,
          ...currentState.placedCards.map((c) => c.zIndex),
        );

        const newCard: PlacedCard = {
          instanceId: uuidv4(),
          imageId,
          x: x + Math.random() * 20, // 稍微随机位置，避免重叠
          y: y + Math.random() * 20,
          rotation: 0,
          scale: 1,
          zIndex: maxZ + 1,
        };

        set((prevState) => ({
          placedCards: [...prevState.placedCards, newCard],
          selectedId: newCard.instanceId,
        }));

        get().saveHistory();
      },

      updateCard: (instanceId, updates) => {
        set((state) => ({
          placedCards: state.placedCards.map((card) =>
            card.instanceId === instanceId ? { ...card, ...updates } : card,
          ),
        }));
      },

      removeCard: (instanceId) => {
        set((state) => ({
          placedCards: state.placedCards.filter(
            (c) => c.instanceId !== instanceId,
          ),
          selectedId: state.selectedId === instanceId ? null : state.selectedId,
        }));
        get().saveHistory();
      },

      bringToFront: (instanceId) => {
        const maxZ = Math.max(0, ...get().placedCards.map((c) => c.zIndex));
        get().updateCard(instanceId, { zIndex: maxZ + 1 });
      },

      setSelectedId: (id) => set({ selectedId: id }),
      setIsDragging: (dragging) => set({ isDragging: dragging }),
      setGridSize: (size) => set({ gridSize: size }),
      setSnapToGrid: (snap) => set({ snapToGrid: snap }),

      saveHistory: () =>
        set((state) => {
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
        set((state) => {
          if (state.historyIndex <= 0) return state;
          const newIndex = state.historyIndex - 1;
          return {
            placedCards: [...state.history[newIndex]],
            historyIndex: newIndex,
            canUndo: newIndex > 0,
            canRedo: true,
          };
        }),

      redo: () =>
        set((state) => {
          if (state.historyIndex >= state.history.length - 1) return state;
          const newIndex = state.historyIndex + 1;
          return {
            placedCards: [...state.history[newIndex]],
            historyIndex: newIndex,
            canUndo: true,
            canRedo: newIndex < state.history.length - 1,
          };
        }),

      copy: () =>
        set((state) => ({
          clipboard: state.selectedId
            ? state.placedCards.filter((c) => c.instanceId === state.selectedId)
            : [],
        })),

      paste: () =>
        set((state) => {
          if (state.clipboard.length === 0) return state;
          const newCards = state.clipboard.map((card) => ({
            ...card,
            instanceId: uuidv4(),
            x: card.x + 20,
            y: card.y + 20,
          }));
          return {
            placedCards: [...state.placedCards, ...newCards],
            selectedId: newCards[0].instanceId,
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
          set((state) => ({
            scenes: [...state.scenes, newScene],
            currentSceneId: id,
            placedCards: newScene.cards,
          }));
        } catch (e) {
          alert("导入失败：文件格式错误");
        }
      },
    }),
    {
      name: "literacy-card-storage",
      storage: createJSONStorage(() => ({
        getItem: async (name: string) => {
          const value = await get(name);
          return value ?? null;
        },
        setItem: async (name: string, value: any) => {
          await set(name, value);
        },
        removeItem: async (name: string) => {
          await del(name);
        },
      })),
      partialize: (state) => ({
        images: state.images,
        scenes: state.scenes,
        currentSceneId: state.currentSceneId,
        canvasColor: state.canvasColor,
        showGrid: state.showGrid, // ← 加上这行
        gridSize: state.gridSize, // ← 顺便加上
        snapToGrid: state.snapToGrid, // ← 顺便加上
      }),
    },
  ),
);
