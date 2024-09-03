import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  Router
} from '@angular/router';
import { padLeft } from 'src/utils/strings';

/**
 * Toggle the presence of a query parameter in the current route.
 *
 * @param router The router instance
 * @param activeRoute The current route snapshot
 * @param key The name of the query parameter to toggle
 * @returns the promise returned from router.navigate
 */
export function toggleRouteQueryParam(
  router: Router,
  activeRoute: ActivatedRouteSnapshot,
  key: string,
  value = '1'
): Promise<boolean> {
  let params = { ...activeRoute.queryParams };
  if (params[key] !== undefined) {
    delete params[key];
  } else {
    params[key] = value;
  }
  return router.navigate([], { queryParams: params });
}

export function toggleRouteQueryParamFunc(
  router: Router,
  activeRoute: ActivatedRoute,
  key: string,
  value = '1'
): () => Promise<boolean> {
  return () => toggleRouteQueryParam(router, activeRoute.snapshot, key, value);
}

export function parseColor(input: string): number[] {
  if (input.substr(0, 1) === '#') {
    const collen = (input.length - 1) / 3;
    const fact = [17, 1, 0.062272][collen - 1];
    return [
      Math.round(parseInt(input.substr(1, collen), 16) * fact),
      Math.round(parseInt(input.substr(1 + collen, collen), 16) * fact),
      Math.round(parseInt(input.substr(1 + 2 * collen, collen), 16) * fact),
    ];
  }

  return input
    .split('(')[1]
    .split(')')[0]
    .split(',')
    .map((x) => +x);
}

export function getContrastFontColor(bgColor: string): string {
  // if (red*0.299 + green*0.587 + blue*0.114) > 186 use #000000 else use #ffffff
  // based on https://stackoverflow.com/a/3943023

  if (!bgColor) {
    return '#000000'
  }

  let col = bgColor;
  if (bgColor.startsWith('#') && bgColor.length > 7) {
    col = bgColor.slice(0, 7);
  }
  const [r, g, b] = parseColor(col);

  if (r * 0.299 + g * 0.587 + b * 0.114 > 186) {
    return '#000000';
  }

  return '#ffffff';
}

export function extractErrorMessage(err: any, prefix: string = ''): string {
  let msg = '';

  console.error(err);

  if (err === null) {
    msg = '<null>';
  } else if (typeof err === 'string') {
    msg = err;
  } else if ('error' in err && typeof err.error === 'string') {
    msg = err.error;
  } else if (
    'error' in err &&
    typeof err.error === 'object' && err.error !== null &&
    'message' in err.error
  ) {
    msg = err.error.message;
  } else if ('error' in err && typeof err.error?.error === 'string') {
    msg = err.error.error;
  } else if ('statusText' in err && typeof err.statusText === 'string') {
    msg = err.statusText;
  } else if ('message' in err && typeof err.message === 'string') {
    msg = err.message;
  }

  // Translate common messages
  if (msg === 'Forbidden') {
    msg = 'Nicht genügend Berechtigungen';
  }

  if (msg !== '' && prefix !== '') {
    msg = prefix + ': ' + msg;
  }

  return msg;
}

export function splitCombinedCustomerAnimalIDs(str: string): [string, string] {
  if (!/^[0-9]*$/.test(str)) {
    throw new Error(`Not a valid customer-animal-id`);
  }
  if (str.length <= 6) {
    throw new Error(`Invalid combined Customer-Animal-ID`);
  }

  const animalID = str.slice(-6);
  const customerID = str.slice(-str.length, -6);

  return [customerID, animalID];
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${padLeft(''+(d.getMonth()+1), 2, '0')}-${padLeft(''+d.getDate(), 2, '0')}`
}

/**
 * Performs a deep merge of objects and returns new object. Does not modify
 * objects (immutable) and merges arrays via concatenation.
 *
 * @param {...object} objects - Objects to merge
 * @returns {object} New object with merged key/values
 */
export function mergeDeep(...objects) {
  const isObject = (obj) => obj && typeof obj === 'object';

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach((key) => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = pVal.concat(...oVal);
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
}
