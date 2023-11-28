// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  baseURL: "https://cis.dobersberg.dev",
  rosterService: "https://roster.dobersberg.dev",
  accountService: 'https://account.dobersberg.dev',
  calendarService: 'https://calendar.dobersberg.dev',
  callService: 'https://3cx-support.dobersberg.dev',
  commentService: 'https://comments.dobersberg.dev'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
import 'zone.js/plugins/zone-error'; // Included with Angular CLI.

