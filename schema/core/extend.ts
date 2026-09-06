import type { Infer } from "./infer";
import type { ObjectNodeInterface } from "./object";
import { ValidationError } from "./validate";
import type { ValueNodeInterface } from "./value";

export const extend = <
  Shape extends Record<string, ValueNodeInterface<any>>,
  Additions extends Record<string, ValueNodeInterface<any>>,
>(
  node: ObjectNodeInterface<{ [Key in keyof Shape]: Infer<Shape[Key]> }, Shape>,
  additions: Additions,
) => {
  type NewShape = Shape & Additions;
  type Output = { [Key in keyof NewShape]: Infer<NewShape[Key]> };
  const shape: NewShape = { ...node.shape, ...additions };

  return {
    validate(input: unknown): Output {
      if (typeof input !== "object" || input === null) {
        throw new ValidationError("NOT_AN_OBJECT");
      }
      const source = input as Record<keyof NewShape, unknown>;
      const output = {} as Output;
      for (const key of Object.keys(shape) as Array<keyof NewShape>) {
        if (!(key in source)) throw new ValidationError("KEY_MISSING");
        output[key] = shape[key].validate(source[key]);
      }
      return output;
    },
    describe: () =>
      Object.fromEntries(
        Object.entries(shape).map(([key, child]) => [key, child.describe()]),
      ),
    produce: (): Output => {
      const base = node.produce() as {
        [Key in keyof Shape]: Infer<Shape[Key]>;
      };
      const output = {} as Output;
      for (const key of Object.keys(shape) as Array<keyof NewShape>) {
        output[key] =
          key in base
            ? (base[key as keyof Shape] as Output[typeof key])
            : shape[key].produce();
      }
      return output;
    },
    shape,
  };
};
