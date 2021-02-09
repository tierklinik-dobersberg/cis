import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'previewUrl'
})
export class PreviewUrlPipe implements PipeTransform {
    transform(value: any, ...args: any[]): any {
        return (value || '').replace('dicomweb://', '//') + '&contentType=image/jpeg';
    }
}