interface SyncMessage {
  type: "scene_update" | "image_add" | "image_remove" | "full_sync";
  payload: any;
  timestamp: number;
  deviceId: string;
}

class SyncManager {
  private ws: WebSocket | null = null;
  private deviceId: string;
  private reconnectInterval: number = 3000;
  private serverUrl: string;

  constructor(serverUrl: string = "wss://your-server.com/sync") {
    this.serverUrl = serverUrl;
    this.deviceId = this.generateDeviceId();
  }

  private generateDeviceId(): string {
    return "device_" + Math.random().toString(36).substr(2, 9);
  }

  connect() {
    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      console.log("同步连接已建立");
      this.requestFullSync();
    };

    this.ws.onmessage = (event) => {
      const message: SyncMessage = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log("同步连接断开，尝试重连...");
      setTimeout(() => this.connect(), this.reconnectInterval);
    };
  }

  private requestFullSync() {
    this.send({ type: "full_sync", payload: null, timestamp: Date.now() });
  }

  private handleMessage(message: SyncMessage) {
    if (message.deviceId === this.deviceId) return;

    switch (message.type) {
      case "scene_update":
        break;
      case "image_add":
        break;
      case "full_sync":
        break;
    }
  }

  send(message: Omit<SyncMessage, "deviceId">) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...message, deviceId: this.deviceId }));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}

export class LocalSyncManager {
  private peer: any;

  async createRoom() {
    // 创建房间，生成二维码供iPad扫描
  }

  async joinRoom(roomId: string) {
    // iPad扫描二维码加入房间
  }
}

export const syncManager = new SyncManager();
