import {
  BoolValue,
  createRegistry,
  Duration,
  ListValue,
  StringValue,
  Struct,
  Timestamp,
  Value,
} from '@bufbuild/protobuf';
import {
  CalendarChangeEvent,
  CustomerAnnotation,
} from '@tierklinik-dobersberg/apis/calendar/v1';
import { Operation } from '@tierklinik-dobersberg/apis/longrunning/v1';
import { OpenChangeEvent } from '@tierklinik-dobersberg/apis/office_hours/v1';
import {
  InstanceReceivedEvent,
  WorklistEntryCreatedEvent,
  WorklistEntryRemovedEvent,
} from '@tierklinik-dobersberg/apis/orthanc_bridge/v1';
import {
  CallRecordReceived,
  OnCallChangeEvent,
  OverwriteCreatedEvent,
  OverwriteDeletedEvent,
  VoiceMailReceivedEvent,
} from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import {
  Document,
  PrintOperationState,
} from '@tierklinik-dobersberg/apis/printing/v1';
import { RosterChangedEvent } from '@tierklinik-dobersberg/apis/roster/v1';
import { BoardEvent, TaskEvent } from '@tierklinik-dobersberg/apis/tasks/v1';

export const registry = createRegistry(
  RosterChangedEvent,
  OnCallChangeEvent,
  OverwriteCreatedEvent,
  OverwriteDeletedEvent,
  CallRecordReceived,
  VoiceMailReceivedEvent,
  CalendarChangeEvent,
  TaskEvent,
  BoardEvent,
  Value,
  Timestamp,
  Duration,
  InstanceReceivedEvent,
  OpenChangeEvent,
  CustomerAnnotation,
  StringValue,
  BoolValue,
  Struct,
  ListValue,
  PrintOperationState,
  Operation,
  Document,
  WorklistEntryCreatedEvent,
  WorklistEntryRemovedEvent
);
