import { Pipe, PipeTransform } from "@angular/core";
import { PhoneExtension } from "@tierklinik-dobersberg/apis/pbx3cx/v1";


@Pipe({
    name: 'knownPhoneExtension',
    pure: true,
    standalone: true
})
export class KnownPhoneExtensionPipe implements PipeTransform {
    transform(extension: string, extensions: PhoneExtension[]) {
        return extensions.find(ext => ext.extension === extension)?.displayName || null
    }
}