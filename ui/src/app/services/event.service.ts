import { Injectable } from "@angular/core";
import { createRegistry, IMessageTypeRegistry, Message } from '@bufbuild/protobuf';
import { injectEventService } from "@tierklinik-dobersberg/angular/connect";
import { OnCallChangeEvent, OverwriteCreatedEvent } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { RosterChangedEvent } from "@tierklinik-dobersberg/apis/roster/v1";
import { Observable, retry } from "rxjs";

@Injectable({providedIn: 'root'})
export class EventService {
    private readonly client = injectEventService();
    private registry: IMessageTypeRegistry;

    constructor() {
        this.registry = createRegistry(
            RosterChangedEvent,
            OnCallChangeEvent,
            OverwriteCreatedEvent,
        )
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
                        } catch(err) {
                            console.error("failed to unpack message", err)
                        }
                    }
                } catch (err) {
                    sub.error(err)
                }
            }

            go();

            return () => {
                abrtCtrl.abort();
                console.log("aborting");
            }
        }).pipe(retry({delay: 5000})) as Observable<T>
    }
}
