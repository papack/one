import { setImmediate } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { Bus } from "./bus";

const timeout = 30_000;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// No machine-dependent throughput assertions: verify delivery under real async
// overlap. Typed arrays retain per-message counts without millions of mock calls.
describe("Bus under load", () => {
  it(
    "delivers 100,000 messages across 1,000 concurrent two-user chats",
    async () => {
      const chats = 1_000;
      const messages = 100;
      const bus = new Bus<Record<string, { chat: number; sequence: number }>>();
      const received = new Uint8Array(chats * messages * 2);
      const errors: unknown[] = [];
        let wrongChat = 0;
      let active = 0;
      let peak = 0;
      const ids: string[] = [];

      for (let chat = 0; chat < chats; chat++) {
        for (let user = 0; user < 2; user++) {
          ids.push(
            bus.on(`chat:${chat}`, async (message) => {
              active++;
              peak = Math.max(peak, active);
              try {
                // Yield to the event loop, as an asynchronous transport would.
                await setImmediate();
                if (message.chat !== chat) wrongChat++;
                received[(chat * messages + message.sequence) * 2 + user]++;
              } catch (error) {
                errors.push(error);
              } finally {
                active--;
              }
            }),
          );
        }
      }

      await Promise.all(
        Array.from({ length: chats }, async (_, chat) => {
          for (let sequence = 0; sequence < messages; sequence++) {
            await bus.emit(`chat:${chat}`, { chat, sequence });
            // Awaiting emit must include both recipients of this message.
            if (
              received[(chat * messages + sequence) * 2] !== 1 ||
              received[(chat * messages + sequence) * 2 + 1] !== 1
            ) {
              throw new Error("emit completed before both recipients finished");
            }
          }
        }),
      );

      expect(received.every((count) => count === 1)).toBe(true);
      expect(wrongChat).toBe(0);
      expect(errors).toEqual([]);
      expect(active).toBe(0);
      expect(peak).toBe(chats * 2);
      ids.forEach((id) => bus.off(id));
    },
    timeout,
  );

  it(
    "drains a burst of 50,000 pending deliveries and consumes 1,000 once listeners exactly once",
    async () => {
      const bus = new Bus<{ message: number }>();
      const gate = deferred();
      const events = 5_000;
      const listeners = 10;
      const received = new Uint8Array(events * listeners);
      const once = new Uint16Array(1_000);
      let started = 0;
      let completed = 0;
      let settled = 0;
      for (let listener = 0; listener < listeners; listener++) {
        bus.on("message", async (sequence) => {
          started++;
          await gate.promise;
          received[sequence * listeners + listener]++;
          completed++;
        });
      }
      for (let i = 0; i < once.length; i++) {
        bus.once("message", async () => {
          await gate.promise;
          once[i]++;
        });
      }
      const pending = Array.from({ length: events }, (_, sequence) =>
        bus.emit("message", sequence).then(() => {
          settled++;
        }),
      );
      try {
        await setImmediate();
        expect(started).toBe(events * listeners);
        expect(completed).toBe(0);
        expect(settled).toBe(0);
      } finally {
        gate.resolve();
        await Promise.all(pending);
      }
      expect(received.every((count) => count === 1)).toBe(true);
      expect(once.every((count) => count === 1)).toBe(true);
      expect(completed).toBe(events * listeners);
      expect(settled).toBe(events);
    },
    timeout,
  );

  it(
    "reports 20,000 failures without dropping healthy deliveries or finishing error reporting early",
    async () => {
      const count = 10_000;
      const reported = new Uint8Array(count * 2);
      const delivered = new Uint8Array(count);
      const invalid: unknown[] = [];
      const syncIds = new Set<string>();
      const asyncIds = new Set<string>();
      const gate = deferred();
      let settled = 0;
      const bus = new Bus<{ message: number }>(async (error, topic, id) => {
        await gate.promise;
        if (
          typeof error !== "number" ||
          topic !== "message" ||
          !(error % 2 === 0 ? syncIds : asyncIds).has(id)
        ) {
          invalid.push({ error, topic, id });
          return;
        }
        reported[error]++;
      });
      syncIds.add(
        bus.on("message", (sequence) => {
          throw sequence * 2;
        }),
      );
      asyncIds.add(
        bus.on("message", async (sequence) => {
          await Promise.resolve();
          throw sequence * 2 + 1;
        }),
      );
      bus.on("message", async (sequence) => {
        await Promise.resolve();
        delivered[sequence]++;
      });
      const pending = Array.from({ length: count }, (_, sequence) =>
        bus.emit("message", sequence).then(() => {
          settled++;
        }),
      );
      try {
        await setImmediate();
        expect(delivered.every((value) => value === 1)).toBe(true);
        expect(settled).toBe(0);
      } finally {
        gate.resolve();
        await Promise.all(pending);
      }
      expect(reported.every((value) => value === 1)).toBe(true);
      expect(invalid).toEqual([]);
      expect(settled).toBe(count);
    },
    timeout,
  );

  it(
    "handles 100,000 registrations and removals while deliveries remain in flight",
    async () => {
      const bus = new Bus<Record<string, number>>();
      let deliveries = 0;
      for (let round = 0; round < 100; round++) {
        const gate = deferred();
        const pending: Promise<void>[] = [];
        const ids: string[] = [];
        for (let connection = 0; connection < 1_000; connection++) {
          const topic = `connection:${round}:${connection}`;
          ids.push(
            bus.on(topic, async () => {
              await gate.promise;
              deliveries++;
            }),
          );
          pending.push(bus.emit(topic, round));
        }
        ids.forEach((id) => bus.off(id));
        // Unsubscribing prevents future delivery, but does not cancel in-flight work.
        for (let connection = 0; connection < 1_000; connection++) {
          pending.push(bus.emit(`connection:${round}:${connection}`, round));
        }
        gate.resolve();
        await Promise.all(pending);
        expect(deliveries).toBe((round + 1) * 1_000);
        // Explicit structural regression check: retained empty topics or ID entries
        // would leak across connection churn. This is not a heap/GC measurement.
        const state = bus as unknown as {
          listeners: Map<unknown, unknown>;
          topicsById: Map<unknown, unknown>;
        };
        expect(state.listeners.size).toBe(0);
        expect(state.topicsById.size).toBe(0);
      }
    },
    timeout,
  );
});
