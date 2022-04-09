import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

@Component({
  selector: 'tkd-user-avatar',
  templateUrl: './user-avatar.html',
  styles: [
    `
    :host {
      @apply rounded-full overflow-hidden block;
    }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAvatarComponent {
  @Input()
  avatar: string = '';

  /** Set to true if loading the avatar image failed */
  displayError = false;
}
