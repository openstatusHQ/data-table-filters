export function isArrayOfNumbers(arr: any[]): arr is number[] {
  return arr.every((item) => typeof item === "number");
}

export function isArrayOfDates(arr: any[]): arr is Date[] {
  return arr.every((item) => item instanceof Date);
}

export function isArrayOfStrings(arr: any[]): arr is string[] {
  return arr.every((item) => typeof item === "string");
}

export function isArrayOfBooleans(arr: any[]): arr is boolean[] {
  return arr.every((item) => typeof item === "boolean");
}
