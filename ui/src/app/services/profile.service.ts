import { Profile, User } from '@tierklinik-dobersberg/apis';
import { environment } from 'src/environments/environment';

export enum UserExtraKey {
  CalendarID = 'calendarID',
  CalendarID2 = 'calendarId',
  Color = 'color',
}

export interface UserProfile extends Profile {
  user: User & {
    extra: {
      fields: {
        [UserExtraKey.CalendarID]?: {
          kind: {
            case: 'stringValue';
            value: string;
          };
        };
        [UserExtraKey.Color]?: {
          kind: {
            case: 'stringValue';
            value: string;
          };
        };
      };
    };
  };
}

export function getCalendarId(
  user: UserProfile | Profile,
  key = UserExtraKey.CalendarID
): string | null {
  const prop = user.user?.extra?.fields[key];

  if (!prop || prop.kind.case !== 'stringValue') {
    if (key == UserExtraKey.CalendarID) {
      return getCalendarId(user, UserExtraKey.CalendarID2);
    }

    return null;
  }

  return prop.kind.value;
}

export function getUserColor(profile: UserProfile | Profile): string | null {
  const prop = profile?.user?.extra?.fields[UserExtraKey.Color];

  if (!prop || prop.kind.case !== 'stringValue') {
    return null;
  }

  return prop.kind.value;
}

export function openProfilePage() {
  window.open(environment.accountService, '_blank');
}
