import { ValidationError } from "../core/validate";

export const isNumber = (input: unknown): asserts input is number => {
  if (typeof input !== "number" || Number.isNaN(input))
    throw new ValidationError("NOT_A_NUMBER");
};

isNumber.empty = 0;
isNumber.meta = {
  _js: { type: "number" },
  _form: { tag: "input", type: "number" },
};
