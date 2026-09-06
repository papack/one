import { ValidationError } from "../core/validate";

export const isString = (input: unknown): asserts input is string => {
  if (typeof input !== "string") throw new ValidationError("NOT_A_STRING");
};

isString.empty = "";
isString.meta = {
  _js: { type: "string" },
  _form: { tag: "input", type: "text" },
};
