import { ValidationError } from "../core/validate";

export const isUnionList = <const Values extends readonly (string | number)[]>(
  values: Values,
  config: { allowEmpty: boolean } = { allowEmpty: true },
) => {
  if (values.length === 0) throw new ValidationError("UNION_EMPTY");
  const baseType = typeof values[0];
  if (baseType !== "string" && baseType !== "number")
    throw new ValidationError("UNION_UNSUPPORTED_TYPE");
  if (values.some((value) => typeof value !== baseType))
    throw new ValidationError("UNION_MIXED_TYPE");

  const validator = (input: unknown): asserts input is Values[number][] => {
    if (!Array.isArray(input)) throw new ValidationError("NOT_A_LIST");
    if (!config.allowEmpty && input.length === 0)
      throw new ValidationError("NOT_IN_UNION");
    for (const item of input) {
      if (
        typeof item !== baseType ||
        !values.includes(item as Values[number])
      ) {
        throw new ValidationError("NOT_IN_UNION");
      }
    }
  };
  validator.empty = config.allowEmpty ? [] : [values[0]];
  validator.meta = {
    _js: { type: `${baseType}[]`, enum: values, allowEmpty: config.allowEmpty },
    _form: {
      tag: "select",
      variant: "multiple",
      options: values.map((value) => ({ value, label: String(value) })),
      allowEmpty: config.allowEmpty,
    },
  };
  return validator;
};
