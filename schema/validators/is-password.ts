import { ValidationError } from "../core/validate";

export const isPassword = (config: {
  minLength: number;
  minNumbers: number;
  minSpecialChars: number;
}) => {
  const validator = (input: unknown): asserts input is string => {
    if (typeof input !== "string") throw new ValidationError("NOT_A_STRING");
    if (input.length < config.minLength)
      throw new ValidationError("PASSWORD_TOO_SHORT");
    if ((input.match(/[0-9]/g)?.length ?? 0) < config.minNumbers) {
      throw new ValidationError("PASSWORD_TOO_FEW_NUMBERS");
    }
    if ((input.match(/[^A-Za-z0-9]/g)?.length ?? 0) < config.minSpecialChars) {
      throw new ValidationError("PASSWORD_TOO_FEW_SPECIALS");
    }
  };
  validator.empty = "";
  validator.meta = {
    _js: { type: "string", ...config },
    _form: { tag: "input", type: "password", ...config },
  };
  return validator;
};
