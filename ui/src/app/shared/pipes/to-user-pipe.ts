import { Pipe, PipeTransform } from "@angular/core";
import { Profile } from "@tkd/apis";
import { Observable, map } from 'rxjs';
import { UserService } from '../../api/user.service';

@Pipe({
  name: 'toUser',
  pure: true,
})
export class ToUserPipe implements PipeTransform {
  constructor(
    private userService: UserService,
  ) {}

  transform(value: string, async: true): Observable<Profile|undefined>;
  transform(value: string): Profile| undefined;

  transform(value: string, async?: true) {
    if (async) {
      return this.userService
        .updated
        .pipe(
          map(() => this.userService.byName(value) || this.userService.byId(value))
        )
    }

    return this.userService.byName(value) || this.userService.byId(value);
  }
}
