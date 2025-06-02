import { Injectable } from "@angular/core";
import { Timestamp } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { injectCalendarService } from "@tierklinik-dobersberg/angular/connect";
import { CalenarEventRequestKind, CalendarEvent } from "@tierklinik-dobersberg/apis/calendar/v1";
import { addSeconds } from "date-fns";
import { toast } from "ngx-sonner";
import { Duration } from "src/utils/duration";

export interface ResourceConflicts {
    resource: string;
    events: CalendarEvent[];
}



@Injectable({providedIn: 'root'})
export class ResourceDetector {
    private readonly calendarService = injectCalendarService();

    private resources: string[] = [];

    constructor() {
        // fetch resource calendars
        // TODO(ppacher): refetch them at some point?
        //                they are unlikely to change ....
        this.calendarService
            .listResourceCalendars({})
            .then(response => {
                this.resources = response.resourceCalendars
                    ?.map(rc => rc.name)
            })
    }

    detectResources(text: string): string[] {
        let result = [];

        // TODO(ppacher): add resource detectors -> update tkd.calendar.v1.ResourceCalendar to add regexp/string detectors

        return result;
    }

    async findResourceConflicts(date: Date, duration: Duration | string, resources: string[]): Promise<ResourceConflicts[]> {
        // fetch all events for the given date
        try {
            let d: number;
            if (typeof duration === 'string') {
                d = Duration.parseString(duration).seconds
            } else {
                d = duration.seconds
            }

            const events = await this.calendarService
                .listEvents({
                    requestKinds: [
                        CalenarEventRequestKind.CALENDAR_EVENT_REQUEST_KIND_VIRTUAL_RESOURCES
                    ],
                    searchTime: {
                        case: 'timeRange',
                        value: {
                            from: Timestamp.fromDate(date),
                            to: Timestamp.fromDate( addSeconds(date, d) )
                        }
                    },
                    source: {
                        case: 'allCalendars',
                        value: true
                    }
                })

            // for each resource, filter 
            let byResource: {
                [r: string]: CalendarEvent[]
            }

            events.results
                ?.forEach(cal => {
                    cal.events
                        ?.forEach(event => {
                            event.resources?.forEach(r => {
                                let arr = byResource[r] || [];
                                arr.push(event) 
                                byResource[r] = arr
                            })
                        })
                })

            let conflicts: ResourceConflicts[] = [];
            Object.keys(byResource)
                .forEach(r => {
                    conflicts.push({
                        resource: r,
                        events: byResource[r]
                    })
                })

            return conflicts

        } catch (err) {
            toast.error('Resourcen-Konflikte konnten nicht überprüft werden', {
                description: ConnectError.from(err).message,
            })

            return []
        }
    }
}