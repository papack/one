import { ValidationError } from "../core/validate";

export const isStringRange = (config: {
  minLength: number;
  maxLength: number;
}) => {
  const { minLength, maxLength } = config;
  if (typeof minLength !== "number" || typeof maxLength !== "number")
    throw new ValidationError("NOT_A_NUMBER");
  if (minLength < 0 || maxLength < 0 || minLength > maxLength) {
    throw new ValidationError("STRING_RANGE_INVALID");
  }
  const validator = (input: unknown): asserts input is string => {
    if (typeof input !== "string") throw new ValidationError("NOT_A_STRING");
    if (input.length < minLength) throw new ValidationError("STRING_TOO_SHORT");
    if (input.length > maxLength) throw new ValidationError("STRING_TOO_LONG");
  };
  validator.empty = "";
  validator.meta = {
    _js: { type: "string", minLength, maxLength },
    _form: { tag: "input", type: "text", minLength, maxLength },
  };
  return validator;
};
