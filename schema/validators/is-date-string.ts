import { ValidationError } from "../core/validate";

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const isDateString = (input: unknown): asserts input is string => {
  if (
    typeof input !== "string" ||
    !ISO_DATETIME_REGEX.test(input) ||
    Number.isNaN(new Date(input).getTime())
  ) {
    throw new ValidationError("NOT_A_DATE");
  }
};

isDateString.empty = "";
isDateString.emptyFactory = () => new Date().toISOString();
isDateString.meta = {
  _js: { type: "string", format: "date-time" },
  _form: { tag: "input", type: "datetime-local" },
};
