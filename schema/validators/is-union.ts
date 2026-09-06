import { ValidationError } from "../core/validate";

export const isUnion = <const Values extends readonly (string | number)[]>(
  ...values: Values
) => {
  if (values.length === 0) throw new ValidationError("UNION_EMPTY");
  const baseType = typeof values[0];
  if (baseType !== "string" && baseType !== "number")
    throw new ValidationError("UNION_UNSUPPORTED_TYPE");
  if (values.some((value) => typeof value !== baseType))
    throw new ValidationError("UNION_MIXED_TYPE");

  const validator = (input: unknown): asserts input is Values[number] => {
    if (
      typeof input !== baseType ||
      !values.includes(input as Values[number])
    ) {
      throw new ValidationError("NOT_IN_UNION");
    }
  };
  validator.empty = values[0];
  validator.meta = {
    _js: { type: baseType },
    _form: {
      tag: "select",
      options: values.map((value) => ({ value, label: String(value) })),
    },
  };
  return validator;
};
