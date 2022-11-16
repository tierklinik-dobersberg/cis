import { Pipe, PipeTransform } from "@angular/core";
import { ProfileWithAvatar } from '@tkd/api';
import { map, Observable } from 'rxjs';
import { UserService } from './../../api/user.service';

@Pipe({
  name: 'toUser',
  pure: true,
})
export class ToUserPipe implements PipeTransform {
  constructor(
    private userService: UserService,
  ) {}

  transform(value: string, async: true): Observable<ProfileWithAvatar>;
  transform(value: string): ProfileWithAvatar;

  transform(value: string, async?: true) {
    if (async) {
      return this.userService
        .updated
        .pipe(
          map(() => this.userService.byName(value))
        )
    }

    return this.userService.byName(value);
  }
}
