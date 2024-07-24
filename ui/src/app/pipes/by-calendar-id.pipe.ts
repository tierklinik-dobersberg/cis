import { Pipe, PipeTransform } from "@angular/core";
import { Profile } from "@tierklinik-dobersberg/apis";
import { getCalendarId } from "../services";

@Pipe({
    name: 'byCalendarId',
    pure: true,
    standalone: true
})
export class ByCalendarIdPipe implements PipeTransform {
    transform(calendarId: string, profiles: Profile[]) {
        const p= profiles.find(p => {
            const profileCalendarId = getCalendarId(p);
            return profileCalendarId === calendarId
        })

        return p
    }
}