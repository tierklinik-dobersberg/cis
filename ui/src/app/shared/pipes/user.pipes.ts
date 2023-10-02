import { Pipe, PipeTransform } from "@angular/core";
import { Profile } from "@tkd/apis";
import { getUserColor } from "src/app/services/profile.service";
import { getContrastFontColor } from "src/app/utils";

@Pipe({
    name: 'displayName',
    pure: true
})
export class UserNamePipe implements PipeTransform {
    static transform(value?: Profile, ...args: any[]) {
        return value?.user?.displayName || value?.user?.username;
    }

    transform(value?: Profile, ...args: any[]) {
      return UserNamePipe.transform(value, args);
    }
}

@Pipe({
    name: 'color',
    pure: true
})
export class UserColorPipe implements PipeTransform {
    transform(value: Profile, ...args: any[]) {
      return getUserColor(value)
    }
}

@Pipe({
    name: 'contrastColor',
    pure: true
})
export class UserContrastColorPipe implements PipeTransform {
    transform(value: Profile, ...args: any[]) {
      return getContrastFontColor(getUserColor(value))
    }
}
