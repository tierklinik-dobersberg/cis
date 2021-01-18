import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'dxrDate'
})
export class DxrDatePipe implements PipeTransform {

    transform(value: any, ...args: any[]): any {
        if (typeof value !== 'string') {
            return value;
        }

        let d = parse(value);
        if (d === null) {
            return value;
        }

        return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    }

}

function parse(str): Date | null {
    const y = str.substr(0, 4),
        m = str.substr(4, 2) - 1,
        d = str.substr(6, 2);
    const D = new Date(y, m, d);

    return (D.getFullYear() == y && D.getMonth() == m && D.getDate() == d) ? D : null;
}