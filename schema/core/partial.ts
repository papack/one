import type { Infer } from "./infer";
import type { ObjectNodeInterface } from "./object";
import { ValidationError } from "./validate";
import type { ValueNodeInterface } from "./value";

export const partial = <Shape extends Record<string, ValueNodeInterface<any>>>(
  node: ObjectNodeInterface<{ [Key in keyof Shape]: Infer<Shape[Key]> }, Shape>,
): ObjectNodeInterface<
  Partial<{ [Key in keyof Shape]: Infer<Shape[Key]> }>,
  Shape
> => {
  type Output = Partial<{ [Key in keyof Shape]: Infer<Shape[Key]> }>;

  return {
    validate(input: unknown): Output {
      if (typeof input !== "object" || input === null) {
        throw new ValidationError("NOT_AN_OBJECT");
      }
      const source = input as Record<string, unknown>;
      const output = {} as Output;
      for (const key in node.shape) {
        if (key in source) output[key] = node.shape[key]!.validate(source[key]);
      }
      return output;
    },
    describe: () =>
      Object.fromEntries(
        Object.entries(node.shape).map(([key, child]) => [
          key,
          { optional: true, value: child.describe() },
        ]),
      ),
    produce: () => ({}),
    shape: { ...node.shape },
  };
};
