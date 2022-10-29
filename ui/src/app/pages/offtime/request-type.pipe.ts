import { Pipe, PipeTransform } from "@angular/core";
import { OffTime } from "src/app/api/roster2";

@Pipe({
    name: 'requestType', 
    pure: true,
})
export class TkdRequestTypePipe implements PipeTransform {
    transform(value: OffTime.Entry): string {
        if (value.requestType === OffTime.RequestType.Credits) {
            return 'Guthaben'
        }

        if (value.approval !== null) {
            if (!value.approval.approved) {
                return '';
            }
            
            if (value.approval.actualCosts.duration > 0) {
                return 'Urlaub';
            }

            return 'ZA'
        }

        switch (value.requestType) {
            case OffTime.RequestType.Auto:
                return 'Urlaub / ZA';
            case OffTime.RequestType.TimeOff:
                return 'ZA'
            case OffTime.RequestType.Vacation:
                return 'Urlaub'
        }

        return '<UNSUPPORTED>';
    }
}