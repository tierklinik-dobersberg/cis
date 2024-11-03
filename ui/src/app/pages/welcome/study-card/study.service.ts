import { inject, Injectable } from "@angular/core";
import { InstanceReceivedEvent } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { Subject } from "rxjs";
import { EventService } from "src/app/services/event.service";

@Injectable({
    providedIn: 'root',
})
export class StudyService {
    protected readonly eventsService = inject(EventService);

    private readonly instanceReceived$ = new Subject<InstanceReceivedEvent>();
    private readonly seenStudies = new Set<string>();

    public instanceReceived = this.instanceReceived$.asObservable();

    constructor() {
        this.eventsService
            .subscribe(new InstanceReceivedEvent)
            .subscribe(event => {
                if (!this.seenStudies.has(event.studyUid)) {
                    this.instanceReceived$.next(event);
                    this.seenStudies.add(event.studyUid);
                }
            })
    }
}