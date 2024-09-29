export function isArrayOfNumbers(arr: any): arr is number[] {
  if (!Array.isArray(arr)) return false;
  return arr.every((item) => typeof item === "number");
}

export function isArrayOfDates(arr: any): arr is Date[] {
  if (!Array.isArray(arr)) return false;
  return arr.every((item) => item instanceof Date);
}

export function isArrayOfStrings(arr: any): arr is string[] {
  if (!Array.isArray(arr)) return false;
  return arr.every((item) => typeof item === "string");
}

export function isArrayOfBooleans(arr: any): arr is boolean[] {
  if (!Array.isArray(arr)) return false;
  return arr.every((item) => typeof item === "boolean");
}

/****************************/

type Flatten<T extends object> = {
  [K in keyof T]: T[K] extends object ? Flatten<T[K]> : T[K];
};

type FlattenedObject<T extends object> = {
  [K in keyof Flatten<T> as K extends string ? K : never]: Flatten<T>[K];
};

export function flattenObject<T extends object>(
  obj: T,
  parentKey = "",
  result: Record<string, any> = {}
): FlattenedObject<T> {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;

      // If the value is an object, recursively flatten it
      if (
        typeof obj[key] === "object" &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        flattenObject<object>(obj[key] as object, newKey, result);
      } else {
        result[newKey] = obj[key];
      }
    }
  }

  return result as FlattenedObject<T>;
}
