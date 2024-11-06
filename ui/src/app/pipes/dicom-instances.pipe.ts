import { Pipe, PipeTransform } from "@angular/core";
import { Instance, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";

@Pipe({
    name: 'dicomInstances',
    pure: true,
    standalone: true
})
export class DicomInstancesPipe implements PipeTransform {
    transform(study: Study): Instance[] {
        const instances: Instance[] = []; 

        study.series?.forEach(series => {
            series.instances?.forEach(instance => instances.push(instance))
        })

        return instances
    }
}