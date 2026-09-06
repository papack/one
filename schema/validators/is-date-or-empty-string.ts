import { isDateString } from "./is-date-string";

export const isDateOrEmptyString = (
  input: unknown,
): asserts input is string => {
  if (input !== "") isDateString(input);
};

isDateOrEmptyString.empty = "";
isDateOrEmptyString.meta = {
  _js: { type: "string", format: "date-time" },
  _form: { tag: "input", type: "datetime-local" },
};
