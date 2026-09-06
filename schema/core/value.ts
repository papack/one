export interface ValueNodeInterface<T> {
  validate: (input: unknown) => T;
  produce: () => T;
  describe: () => unknown;
}

type RuntimeCB<T> = {
  (input: unknown): asserts input is T;
  meta?: unknown;
  empty?: T;
  emptyFactory?: () => T;
};

export const value = <T>(cb: RuntimeCB<T>): ValueNodeInterface<T> => {
  const validate = (input: unknown): T => {
    cb(input);
    return input as T;
  };

  return {
    validate,
    describe: () => cb.meta,
    produce: () =>
      (cb.emptyFactory === undefined ? cb.empty : cb.emptyFactory()) as T,
  };
};
