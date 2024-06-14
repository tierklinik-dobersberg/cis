import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: 'toRgba',
  pure: true,
  standalone: true
})
export class ToRGBAPipe implements PipeTransform {
  transform(input: string, alpha: string = ''): string {
    return ToRGBAPipe.transform(input, alpha);
  }

  static transform(input: string, alpha: string = ''): string {
    const rgb = hexToRgb(input);

    const result = `rgb(${rgb.r} ${rgb.g} ${rgb.b}`

    if (alpha) {
      return result + " / " + alpha + ")"
    }

    return result + ")"
  }
}

function hexToRgb(hex: string) {
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
