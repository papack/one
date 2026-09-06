import { ValidationError } from "../core/validate";

export const isNumberRange = (min: number, max: number) => {
  if (
    typeof min !== "number" ||
    Number.isNaN(min) ||
    typeof max !== "number" ||
    Number.isNaN(max)
  ) {
    throw new ValidationError("NOT_A_NUMBER");
  }
  if (min > max) throw new ValidationError("NUMBER_RANGE_INVALID");

  const validator = (input: unknown): asserts input is number => {
    if (typeof input !== "number" || Number.isNaN(input))
      throw new ValidationError("NOT_A_NUMBER");
    if (input < min || input > max)
      throw new ValidationError("NUMBER_RANGE_VIOLATION");
  };
  validator.empty = min;
  validator.meta = {
    _js: { type: "number", min, max },
    _form: { tag: "select", type: "number", min, max },
  };
  return validator;
};
