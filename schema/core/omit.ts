import type { Infer } from "./infer";
import type { ObjectNodeInterface } from "./object";
import { ValidationError } from "./validate";
import type { ValueNodeInterface } from "./value";

export const omit = <
  Shape extends Record<string, ValueNodeInterface<any>>,
  Keys extends readonly (keyof Shape)[],
>(
  node: ObjectNodeInterface<{ [Key in keyof Shape]: Infer<Shape[Key]> }, Shape>,
  keys: Keys,
): ObjectNodeInterface<
  { [Key in Exclude<keyof Shape, Keys[number]>]: Infer<Shape[Key]> },
  { [Key in Exclude<keyof Shape, Keys[number]>]: Shape[Key] }
> => {
  const excluded = new Set<keyof Shape>(keys);
  const shape = {} as {
    [Key in Exclude<keyof Shape, Keys[number]>]: Shape[Key];
  };

  for (const key of Object.keys(node.shape) as Array<keyof Shape>) {
    if (!excluded.has(key)) {
      shape[key as Exclude<keyof Shape, Keys[number]>] = node.shape[
        key
      ] as Shape[Exclude<keyof Shape, Keys[number]>];
    }
  }

  type Output = {
    [Key in Exclude<keyof Shape, Keys[number]>]: Infer<Shape[Key]>;
  };

  return {
    validate(input: unknown): Output {
      if (typeof input !== "object" || input === null) {
        throw new ValidationError("NOT_AN_OBJECT");
      }
      const source = input as Record<keyof Shape, unknown>;
      const output = {} as Output;
      for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
        if (!(key in source)) throw new ValidationError("KEY_MISSING");
        output[key] = shape[key].validate(source[key]);
      }
      return output;
    },
    describe: () => {
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
        output[key as string] = shape[key].describe();
      }
      return output;
    },
    produce: (): Output => {
      const base = node.produce() as {
        [Key in keyof Shape]: Infer<Shape[Key]>;
      };
      const output = {} as Output;
      for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
        output[key] = base[key];
      }
      return output;
    },
    shape,
  };
};
