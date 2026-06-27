// 识字卡图片项
export interface CardImage {
  id: string;
  src: string;
  name: string;
  category: string;
  createdAt: number;
  width: number;
  height: number;
}

// 拼图场景中的卡片实例
export interface PlacedCard {
  instanceId: string;
  imageId: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
}

// 保存的场景
export interface Scene {
  id: string;
  name: string;
  cards: PlacedCard[];
  backgroundColor: string;
  gridSize: number;
  snapToGrid: boolean;
  createdAt: number;
  updatedAt: number;
}
