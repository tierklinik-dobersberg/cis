import { Pipe, PipeTransform } from "@angular/core";
import { getContrastFontColor } from "@tierklinik-dobersberg/angular/pipes";

@Pipe({
    standalone: true,
    pure: true,
    name: 'contrast'
})
export class ContrastColorPipe implements PipeTransform {
    transform(color: string) {
        if (!color) {
            return 'inherit';
        }

        return getContrastFontColor(color); 
    }
}