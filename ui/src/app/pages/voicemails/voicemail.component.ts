import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, combineLatest, forkJoin, interval, Observable, of, Subscription } from "rxjs";
import { catchError, mergeMap, startWith } from "rxjs/operators";
import { VoiceMailAPI, VoiceMailRecording } from "src/app/api";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { VoiceMailsRoutingModule } from "./voicemails-routing.module";

interface VoiceMailWithCustomer extends VoiceMailRecording {
    customer?: Customer;
}

@Component({
    templateUrl: './voicemail.component.html',
    styleUrls: ['./voicemail.component.scss'],
})
export class VoiceMailComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;
    private date$ = new BehaviorSubject<Date>(new Date());

    get date() {
        return this.date$.getValue();
    }

    recordings: VoiceMailWithCustomer[] = [];

    constructor(
        private voicemailsapi: VoiceMailAPI,
        private customersapi: CustomerAPI,
        private route: ActivatedRoute,
    ) { }

    onChange(date: Date) {
        this.date$.next(date);
    }

    ngOnInit() {
        this.subscriptions = new Subscription();

        let paramSub =
            combineLatest([
                interval(10000).pipe(startWith(-1)),
                this.route.paramMap,
                this.date$,
            ])
                .pipe(
                    mergeMap(([_, params, date]) => {
                        return this.voicemailsapi.forDate(date, params.get("name"))
                    }),
                    mergeMap(recordings => {
                        let m = new Map<string, [string, number]>();
                        recordings.forEach(rec => {
                            if (!rec.customerSource) {
                                return;
                            };
                            m.set(`${rec.customerSource}/${rec.customerID}`, [rec.customerSource, rec.customerID])
                        })

                        let observables: {
                            recordings: Observable<VoiceMailRecording[]>;
                            [key: string]: Observable<any>;
                        } = {
                            recordings: of(recordings),
                        }

                        Array.from(m.entries()).forEach(([key, [source, id]]) => {
                            observables[key] = this.customersapi.byId(source, id)
                                .pipe(catchError(() => of(null as Customer)));
                        })

                        return forkJoin(observables);
                    })
                )
                .subscribe((result: { [key: string]: any }) => {
                    this.recordings = result.recordings.map(record => {
                        return {
                            ...record,
                            customer: result[`${record.customerSource}/${record.customerID}`],
                        }
                    })
                })

        this.subscriptions.add(paramSub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }

    trackRecording(_: number, r: VoiceMailRecording) {
        return r._id;
    }
}