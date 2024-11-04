import { Pipe, PipeTransform } from "@angular/core";
import { DICOMTag } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";

@Pipe({
    name: 'sortDicomTags',
    pure: true,
    standalone: true
})
export class SortDicomTagsPipe implements PipeTransform {
    transform(tags: DICOMTag[]) {
        return [...tags]
            .sort((a, b) => {
                const hexA = parseInt(a.tag, 16)
                const hexB = parseInt(b.tag, 16)

                return hexB - hexA
            }) 
    }
}