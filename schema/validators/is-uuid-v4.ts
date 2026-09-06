import { randomUUID } from "node:crypto";
import { ValidationError } from "../core/validate";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuidv4 = (input: unknown): asserts input is string => {
  if (typeof input !== "string" || !UUID_V4_REGEX.test(input)) {
    throw new ValidationError("NOT_A_UUID_V4");
  }
};

isUuidv4.empty = "";
isUuidv4.emptyFactory = randomUUID;
isUuidv4.meta = {
  _js: { type: "string", format: "uuid" },
  _form: { tag: "input", type: "text" },
};
