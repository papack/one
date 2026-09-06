import { ValidationError } from "../core/validate";

export const isBoolean = (input: unknown): asserts input is boolean => {
  if (typeof input !== "boolean") throw new ValidationError("NOT_A_BOOLEAN");
};

isBoolean.empty = false;
isBoolean.meta = { _js: { type: "boolean" }, _form: { tag: "checkbox" } };
