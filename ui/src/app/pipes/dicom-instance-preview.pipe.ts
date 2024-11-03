import { inject, Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { Instance } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";

@Pipe({
    name: 'dicomImageUrl',
    pure: true,
    standalone: true,
})
export class DicomImageUrlPipe implements PipeTransform {
    private readonly sanitizier = inject(DomSanitizer);

    transform(instance: Instance, opt?: {width?: number, height?: number, frame?: number}) {
        let url = instance.tags.find(t => t.name === 'RetrieveURL');
        if (!url?.value?.length) {
            url = instance.tags.find(t => t.name === 'RetrieveURI');
        }

        if(url?.value?.length) {
            let first = url.value[0].toJson() as string;
            let frameIdx = 1;

            if (opt && opt.frame && opt.frame > 1) {
                frameIdx = opt.frame
            }

            first += `/frames/${frameIdx}/rendered`

            if (opt) {
                const {width, height} = opt;
                if (width && height) {
                    first += `?viewport=${width},${height}`
                }
            }

            return this.sanitizier.bypassSecurityTrustResourceUrl(first)
        }

        return '';
    }
}