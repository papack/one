type UUID = string;

export type ReadFn<T> = ((callback?: (value: T) => void) => T) & {
  type: "signal";
};

export function signal<T>(initialValue: T) {
  let value = initialValue;
  const uuid = crypto.randomUUID();

  connector.addTopic(uuid);

  const read: ReadFn<T> = (callback?: (value: T) => void): T => {
    if (callback) {
      connector.registerCallback(uuid, callback);
      callback(value);
    }

    return value;
  };

  read.type = "signal";

  const write = async (update: (previous: T) => T | Promise<T>) => {
    const next = update(value);
    value = next instanceof Promise ? await next : next;
    connector.update(uuid, value);
  };

  return [read, write] as const;
}

interface CallbackEntry {
  uuid: UUID;
  references: number;
}

class Connector {
  private topics = new Map<UUID, Set<(value: unknown) => void>>();
  private callbacks = new Map<(value: unknown) => void, CallbackEntry>();

  addTopic(uuid: UUID): void {
    this.topics.set(uuid, new Set());
  }

  registerCallback<T>(uuid: UUID, callback: (value: T) => void): void {
    const listeners = this.topics.get(uuid);
    if (!listeners) throw new Error(`DOM signal: unknown topic ${uuid}`);

    const existing = this.callbacks.get(callback as (value: unknown) => void);
    if (existing) {
      existing.references++;
      return;
    }

    listeners.add(callback as (value: unknown) => void);
    this.callbacks.set(callback as (value: unknown) => void, {
      uuid,
      references: 1,
    });
  }

  removeCallback<T>(callback: (value: T) => void): void {
    const entry = this.callbacks.get(callback as (value: unknown) => void);
    if (!entry) return;

    entry.references--;
    if (entry.references > 0) return;

    this.topics.get(entry.uuid)?.delete(callback as (value: unknown) => void);
    this.callbacks.delete(callback as (value: unknown) => void);
  }

  update<T>(uuid: UUID, value: T): void {
    for (const callback of this.topics.get(uuid) ?? []) callback(value);
  }
}

export const connector = new Connector();
