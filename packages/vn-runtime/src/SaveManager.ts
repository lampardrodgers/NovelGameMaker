export interface VNSaveData {
  projectId: string;
  projectVersion?: string | number;
  beatId?: string;
  beatIndex?: number;
  createdAt: string;
  savedAt?: string;
}

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemorySaveStorage implements SaveStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export class SaveManager {
  private readonly storage: SaveStorage;
  private readonly namespace: string;

  constructor(input: { storage?: SaveStorage; namespace?: string } = {}) {
    this.storage = input.storage ?? getDefaultStorage();
    this.namespace = input.namespace ?? "novel-game-maker";
  }

  save(slot: string, data: VNSaveData): void {
    this.storage.setItem(this.key(slot), JSON.stringify(data));
  }

  load(slot: string): VNSaveData | undefined {
    const raw = this.storage.getItem(this.key(slot));
    if (!raw) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as VNSaveData;
    } catch {
      return undefined;
    }
  }

  remove(slot: string): void {
    this.storage.removeItem(this.key(slot));
  }

  clear(slot: string): void {
    this.remove(slot);
  }

  private key(slot: string): string {
    return `${this.namespace}:save:${slot}`;
  }
}

function getDefaultStorage(): SaveStorage {
  if (typeof localStorage !== "undefined") {
    return localStorage;
  }
  return new MemorySaveStorage();
}
