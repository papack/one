import type { ValueNodeInterface } from "./value";

export type Infer<TNode> =
  TNode extends ValueNodeInterface<infer Value> ? Value : never;
