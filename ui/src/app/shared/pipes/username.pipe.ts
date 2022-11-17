import { Pipe, PipeTransform } from "@angular/core";
import { Profile } from "@tkd/api";

@Pipe({
    name: 'username',
    pure: true
})
export class UserNamePipe implements PipeTransform {
    transform(value?: Profile, ...args: any[]) {
        return value?.fullname || value?.name || '';
    }
}