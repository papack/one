import type { Infer } from "./infer";
import type { ObjectNodeInterface } from "./object";
import { ValidationError } from "./validate";
import type { ValueNodeInterface } from "./value";

export const pick = <
  Shape extends Record<string, ValueNodeInterface<any>>,
  Keys extends readonly (keyof Shape)[],
>(
  node: ObjectNodeInterface<{ [Key in keyof Shape]: Infer<Shape[Key]> }, Shape>,
  keys: Keys,
): ObjectNodeInterface<
  { [Key in Keys[number]]: Infer<Shape[Key]> },
  { [Key in Keys[number]]: Shape[Key] }
> => {
  const shape = {} as { [Key in Keys[number]]: Shape[Key] };
  for (const key of keys) shape[key] = node.shape[key];
  type Output = { [Key in Keys[number]]: Infer<Shape[Key]> };

  return {
    validate(input: unknown): Output {
      const source = node.validate(input) as {
        [Key in keyof Shape]: Infer<Shape[Key]>;
      };
      const output = {} as Output;
      for (const key of keys) {
        if (!(key in source)) throw new ValidationError("KEY_MISSING");
        output[key] = source[key];
      }
      return output;
    },
    describe: () =>
      Object.fromEntries(keys.map((key) => [key, node.shape[key].describe()])),
    produce: (): Output => {
      const source = node.produce() as {
        [Key in keyof Shape]: Infer<Shape[Key]>;
      };
      const output = {} as Output;
      for (const key of keys) output[key] = source[key];
      return output;
    },
    shape,
  };
};
