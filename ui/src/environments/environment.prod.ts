import { ConnectConfig } from '@tierklinik-dobersberg/angular/connect';
import { registry } from 'src/app/type-registry';

interface Env extends ConnectConfig {
  [key: string]: any
}

export const environment: Env = {
  production: false,
  baseURL: '', // "https://my.dobersberg.vet",
  accountService: 'https://account.dobersberg.vet',
  calendarService: 'https://calendar.dobersberg.vet',
  rosterService: "https://roster.dobersberg.vet",
  callService: "https://3cx.dobersberg.vet",
  commentService: 'https://comments.dobersberg.vet',
  customerService: 'https://customer.dobersberg.vet',
  eventService: 'https://events.dobersberg.vet',
  taskService: 'https://tasks.dobersberg.vet',
  officeHourService: 'https://officehours.dobersberg.vet',
  orthancBridge: 'https://dicom.dobersberg.vet',

  registry: registry,
};

import 'zone.js/plugins/zone-error'; // Included with Angular CLI.
