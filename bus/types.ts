export type BusListener<T> = (data: T) => unknown;

export type BusErrorHandler<Events> = (
  error: unknown,
  topic: keyof Events,
  listenerId: string,
) => unknown;

export interface BusPortInterface<Events> {
  on<K extends keyof Events>(topic: K, cb: BusListener<Events[K]>): string;
  off(uuid: string): void;
  once<K extends keyof Events>(topic: K, cb: BusListener<Events[K]>): string;
  emit<K extends keyof Events>(topic: K, data: Events[K]): Promise<void>;
}
