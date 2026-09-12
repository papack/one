// repeat.ts
import type { ReadFn } from "../signal";
import { signal } from "../signal";
import { For } from "../for";
import { effect } from "../effect";
import { jsx } from "../../jsx";
import type { JSXElement } from "../../jsx/jsx";

type MaybeSignal<T> = T | ReadFn<T>;

interface RepeatPropsInterface {
  n: MaybeSignal<number>;
  children?: JSXElement | JSXElement[];
}

export function Repeat({ n, children }: RepeatPropsInterface) {
  const childNodes =
    children == null ? [] : Array.isArray(children) ? children : [children];
  const renderItem = () =>
    jsx("dom-repeat-item", { style: { display: "contents" } }, ...childNodes);

  // static case
  if (typeof n === "number") {
    return Array.from({ length: n }, renderItem) as JSXElement;
  }

  // reactive case -> delegate to For
  const count = n;

  const [items, setItems] = signal<{ uuid: string }[]>([]);

  const updateItems = (nextCount: number) => {
    const next: { uuid: string }[] = [];
    for (let i = 0; i < nextCount; i++) {
      next.push({ uuid: String(i) });
    }
    return setItems(() => next);
  };

  void updateItems(count());
  effect(count, updateItems);

  return <For each={items}>{[renderItem]}</For>;
}
