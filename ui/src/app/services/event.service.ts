import { effect, Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { IMessageTypeRegistry, Message } from '@bufbuild/protobuf';
import { injectEventService } from "@tierklinik-dobersberg/angular/connect";
import { CalendarChangeEvent } from "@tierklinik-dobersberg/apis/calendar/v1";
import { Operation } from "@tierklinik-dobersberg/apis/longrunning/v1";
import { OpenChangeEvent } from "@tierklinik-dobersberg/apis/office_hours/v1";
import { InstanceReceivedEvent } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { CallRecordReceived, OnCallChangeEvent, OverwriteCreatedEvent, OverwriteDeletedEvent, VoiceMailReceivedEvent } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { RosterChangedEvent } from "@tierklinik-dobersberg/apis/roster/v1";
import { BoardEvent, TaskEvent } from "@tierklinik-dobersberg/apis/tasks/v1";
import { filter, interval, merge, Observable, PartialObserver, retry, Subject, Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { injectStoredProfile } from "../utils/inject-helpers";

@Injectable({providedIn: 'root'})
export class EventService {
    private readonly client = injectEventService();
    private registry: IMessageTypeRegistry;
    private readonly profile = injectStoredProfile();
    private readonly profile$ = toObservable(this.profile)

    private events$ = new Subject<Message<any>>();

    constructor() {
        this.registry = environment.registry;
        
        const effectRef = effect(() => {
            const profile = this.profile(); 
            
            if (!profile) {
                return
            }
            
            effectRef.destroy();
            
            this.listen([
                new RosterChangedEvent,
                new OnCallChangeEvent,
                new OverwriteCreatedEvent,
                new OverwriteDeletedEvent,
                new CallRecordReceived,
                new VoiceMailReceivedEvent,
                new CalendarChangeEvent,
                new TaskEvent,
                new BoardEvent,
                new InstanceReceivedEvent,
                new OpenChangeEvent,
                new Operation
            ])
            .subscribe(event => this.events$.next(event))
        })

    }

    public subscribe<T extends Message>(f: T | T[]): Observable<T>;
    public subscribe<T extends Message>(f: T | T[], observer: PartialObserver<T>): Subscription;

    public subscribe<T extends Message>(f: T | T[], observer?: PartialObserver<T>): Observable<T> | Subscription {
        const stream = this.events$
            .pipe(
                filter(msg => Array.isArray(f) ? f.some(t => msg instanceof t.getType()) : msg instanceof f.getType())
            ) as unknown as Observable<T>
            
        if (!observer) {
            return stream;
        }
        
        return stream.subscribe(observer);
    }

    public listen<T extends Message>(msgs: T[]): Observable<T> {
        return new Observable(sub => {
            const abrtCtrl = new AbortController();

            const iterator = this.client.subscribeOnce({
                typeUrls: msgs.map(m => m.getType().typeName)
            }, { signal: abrtCtrl.signal })

            const go = async () => {
                try {
                    for await (const msg of iterator) {
                        try {
                            let e: any = msg.event.unpack(this.registry);
                            sub.next(e);

                            console.log("received event", e)
                        } catch(err) {
                            console.error("failed to unpack message", err)
                        }
                    }
                } catch (err) {
                    console.log("error receiving event", err)
                    sub.error(err)
                }
            }

            go();

            return () => {
                abrtCtrl.abort();
                console.log("aborting");
            }
        }).pipe(retry({delay: () => merge(interval(5000), this.profile$)})) as Observable<T>
    }
}
