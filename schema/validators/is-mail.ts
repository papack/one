import { ValidationError } from "../core/validate";

export const isMail = (input: unknown): asserts input is string => {
  if (typeof input !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
    throw new ValidationError("NOT_A_MAIL");
  }
};

isMail.empty = "";
isMail.meta = {
  _js: { type: "string" },
  _form: { tag: "input", type: "email" },
};
