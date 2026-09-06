import type { Infer } from "./infer";
import { ValidationError } from "./validate";
import type { ValueNodeInterface } from "./value";

export interface ObjectNodeInterface<T, Shape> extends ValueNodeInterface<T> {
  readonly shape: Shape;
}

export const object = <Shape extends Record<string, ValueNodeInterface<any>>>(
  shape: Shape,
): ObjectNodeInterface<{ [Key in keyof Shape]: Infer<Shape[Key]> }, Shape> => {
  type Output = { [Key in keyof Shape]: Infer<Shape[Key]> };

  const validate = (input: unknown): Output => {
    if (typeof input !== "object" || input === null) {
      throw new ValidationError("NOT_AN_OBJECT");
    }

    const source = input as Record<string, unknown>;
    const output = {} as Output;
    for (const key in shape) {
      if (!(key in source)) throw new ValidationError("KEY_MISSING");
      const child = shape[key];
      if (child !== undefined) output[key] = child.validate(source[key]);
    }
    return output;
  };

  const describe = () => {
    const output: Record<string, unknown> = {};
    for (const key in shape) {
      const child = shape[key];
      if (child !== undefined) output[key] = child.describe();
    }
    return output;
  };

  const produce = (): Output => {
    const output = {} as Output;
    for (const key in shape) {
      const child = shape[key];
      if (child !== undefined) output[key] = child.produce();
    }
    return output;
  };

  return { validate, describe, produce, shape };
};
