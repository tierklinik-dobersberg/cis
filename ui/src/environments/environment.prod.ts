import { createRegistry } from '@bufbuild/protobuf';
import { ConnectConfig } from '@tierklinik-dobersberg/angular/connect';
import { CalendarChangeEvent } from '@tierklinik-dobersberg/apis/calendar/v1';
import { CallRecordReceived, OnCallChangeEvent, OverwriteCreatedEvent, OverwriteDeletedEvent, VoiceMailReceivedEvent } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { RosterChangedEvent } from '@tierklinik-dobersberg/apis/roster/v1';
import { BoardEvent, TaskEvent } from '@tierklinik-dobersberg/apis/tasks/v1';

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
  
  registry: createRegistry(
    RosterChangedEvent,
    OnCallChangeEvent,
    OverwriteCreatedEvent,
    OverwriteDeletedEvent,
    CallRecordReceived,
    VoiceMailReceivedEvent,
    CalendarChangeEvent,
    TaskEvent,
    BoardEvent,
  )
};

import 'zone.js/plugins/zone-error'; // Included with Angular CLI.
