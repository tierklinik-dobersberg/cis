import { Pipe, PipeTransform } from "@angular/core";
import { Role } from "@tierklinik-dobersberg/apis/idm/v1";

@Pipe({
    pure: true,
    standalone: true,
    name: "toRole"
})
export class ToRolePipe implements PipeTransform {
    transform(roleId: string, roles: Role[]) {
        return roles.find(r => r.id === roleId) 
    }
}