// Disable eslint to allow any type for the following function to work with any types
/* eslint-disable */ 

/**
 * Replaces all null values in an object with `undefined`
 * @param obj an object
 * @returns object with no null values
 */
export function nulls2undefined(obj: any): any {
  if (obj === null) {
    return undefined;
  }
  if (typeof obj === 'object') {
    for (const key in obj) {
      obj[key] = nulls2undefined(obj[key]);
    }
  }
  return obj;
}
/* eslint-enable */