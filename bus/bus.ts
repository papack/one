import type { BusErrorHandler, BusListener, BusPortInterface } from "./types";

type Listener = {
  callback: BusListener<never>;
  once: boolean;
};

/** In-process broadcast bus. Listener results are ignored. */
export class Bus<Events> implements BusPortInterface<Events> {
  private listeners = new Map<keyof Events, Map<string, Listener>>();
  private topicsById = new Map<string, keyof Events>();

  constructor(
    private readonly onError: BusErrorHandler<Events> = (error, topic, id) => {
      console.error("Bus listener failed", { topic, listenerId: id, error });
    },
  ) {}

  public on<K extends keyof Events>(
    topic: K,
    cb: BusListener<Events[K]>,
  ): string {
    return this.register(topic, cb, false);
  }

  /** Also returns an ID so an unused once listener can be removed. */
  public once<K extends keyof Events>(
    topic: K,
    cb: BusListener<Events[K]>,
  ): string {
    return this.register(topic, cb, true);
  }

  public off(uuid: string): void {
    if (!this.topicsById.has(uuid)) return;
    const topic = this.topicsById.get(uuid)!;
    const listeners = this.listeners.get(topic)!;
    listeners.delete(uuid);
    this.topicsById.delete(uuid);
    if (listeners.size === 0) this.listeners.delete(topic);
  }

  /**
   * Starts listeners in registration order, then waits for all of them.
   * Additions during delivery wait for the next emit; removals take effect now.
   * Synchronous callback work runs before emit returns.
   */
  public async emit<K extends keyof Events>(
    topic: K,
    data: Events[K],
  ): Promise<void> {
    const listeners = this.listeners.get(topic);
    if (!listeners) return;

    await Promise.all(
      Array.from(listeners).map(async ([id, listener]) => {
        if (!listeners.has(id)) return;
        if (listener.once) this.off(id);

        try {
          // Registration ties each callback to the payload type of this topic.
          const callback = listener.callback as BusListener<Events[K]>;
          await callback(data);
        } catch (error) {
          await this.reportError(error, topic, id);
        }
      }),
    );
  }

  private register<K extends keyof Events>(
    topic: K,
    cb: BusListener<Events[K]>,
    once: boolean,
  ): string {
    const id = crypto.randomUUID();
    let listeners = this.listeners.get(topic);
    if (!listeners) {
      listeners = new Map();
      this.listeners.set(topic, listeners);
    }
    listeners.set(id, { callback: cb as BusListener<never>, once });
    this.topicsById.set(id, topic);
    return id;
  }

  private async reportError(
    error: unknown,
    topic: keyof Events,
    id: string,
  ): Promise<void> {
    const fallback = (handlerError: unknown): void => {
      // Error reporting must not interrupt delivery or reject an ignored promise.
      try {
        console.error("Bus error handler failed", {
          topic,
          listenerId: id,
          error,
          handlerError,
        });
      } catch {
        // There is no remaining reporting channel if console.error itself fails.
      }
    };

    try {
      await this.onError(error, topic, id);
    } catch (handlerError) {
      fallback(handlerError);
    }
  }
}
