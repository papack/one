export type ValidationErrorCodeType =
  | "KEY_MISSING"
  | "NOT_A_BOOLEAN"
  | "NOT_A_DATE"
  | "NOT_A_LIST"
  | "NOT_A_MAIL"
  | "NOT_A_NUMBER"
  | "NOT_A_STRING"
  | "NOT_A_UUID_V4"
  | "NOT_AN_OBJECT"
  | "NOT_IN_UNION"
  | "NUMBER_RANGE_INVALID"
  | "NUMBER_RANGE_VIOLATION"
  | "PASSWORD_TOO_FEW_NUMBERS"
  | "PASSWORD_TOO_FEW_SPECIALS"
  | "PASSWORD_TOO_SHORT"
  | "STRING_RANGE_INVALID"
  | "STRING_TOO_LONG"
  | "STRING_TOO_SHORT"
  | "UNION_EMPTY"
  | "UNION_MIXED_TYPE"
  | "UNION_UNSUPPORTED_TYPE";

export class ValidationError extends Error {
  constructor(public code: ValidationErrorCodeType) {
    super(code);
    this.name = "ValidationError";
  }
}
