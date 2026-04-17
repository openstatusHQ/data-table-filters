export type MakeArray<T> = {
  [P in keyof T]: T[P][];
};
