import { createRegistry, Duration, Timestamp, Value } from "@bufbuild/protobuf";
import { CalendarChangeEvent } from "@tierklinik-dobersberg/apis/calendar/v1";
import { CallRecordReceived, OnCallChangeEvent, OverwriteCreatedEvent, OverwriteDeletedEvent, VoiceMailReceivedEvent } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { RosterChangedEvent } from "@tierklinik-dobersberg/apis/roster/v1";
import { BoardEvent, TaskEvent } from "@tierklinik-dobersberg/apis/tasks/v1";

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
    Duration
  )