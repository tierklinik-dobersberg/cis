import { Pipe, PipeTransform } from "@angular/core";
import { UIConfig } from "../api";


@Pipe({
    name: 'knownPhoneExtension',
    pure: true,
    standalone: true
})
export class KnownPhoneExtensionPipe implements PipeTransform {
    private extensionMap = new Map<string, string>();
    private oldConfigRef: UIConfig | null = null;

    transform(extension: string, config: UIConfig) {
        if (this.oldConfigRef !== config) {
            this.oldConfigRef = config;
            this.extensionMap.clear();

            config.KnownPhoneExtension?.forEach(kpe => this.extensionMap.set(kpe.ExtensionNumber, kpe.DisplayName))
        } 

        return this.extensionMap.get(extension) || null;
    }
}