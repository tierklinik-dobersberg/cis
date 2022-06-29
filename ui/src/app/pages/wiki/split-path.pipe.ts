import { isDevMode, Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: 'splitPath',
  pure: true,
})
export class SplitPathPipe implements PipeTransform {
  transform(value: any, ...args: any[]) {
    if (value === null || value === undefined) {
      return [];
    }

    if (typeof value !== 'string') {
      if (isDevMode()) {
        throw new Error(`Expected a string input for value`)
      }
      return []
    }

    // skip the first character if it's a path separator
    if (value.length > 0 && value[0] === '/') {
      value = value.substring(1)
    }

    return value.split('/');
  }
}
