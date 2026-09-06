import { ValidationError } from "./validate";
import type { ValueNodeInterface } from "./value";

export interface ListNodeInterface<T> extends ValueNodeInterface<T[]> {}

export const list = <T>(node: ValueNodeInterface<T>): ListNodeInterface<T> => ({
  validate(input: unknown): T[] {
    if (!Array.isArray(input)) throw new ValidationError("NOT_A_LIST");
    return input.map((item) => node.validate(item));
  },
  describe: () => [node.describe()],
  produce: () => [],
});
