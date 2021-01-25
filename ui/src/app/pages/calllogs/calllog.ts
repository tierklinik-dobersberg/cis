import { Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { forkJoin, interval, of, Subscription } from "rxjs";
import { catchError, mergeMap, startWith } from "rxjs/operators";
import { CallLog, CalllogAPI } from "src/app/api";
import { Customer, CustomerAPI } from "src/app/api/customer.api";

interface LocalCallLog extends CallLog {
    localDate: string;
    customer?: Customer;
}

@Component({
    templateUrl: './calllog.html',
    styleUrls: ['./calllog.scss'],
})
export class CallLogComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;

    logs: LocalCallLog[] = [];

    trackLog: TrackByFunction<CallLog> = (i: number, l: LocalCallLog) => {
        if (!!l) {
            return l._id!;
        }

        return i;
    };

    constructor(
        private calllogapi: CalllogAPI,
        private customerapi: CustomerAPI,
    ) { }

    ngOnInit() {
        this.subscriptions = new Subscription();

        const sub =
            interval(5000)
                .pipe(
                    startWith(0),
                    mergeMap(() => {
                        const d = new Date();
                        const year = d.getFullYear();
                        const month = d.getMonth() + 1
                        const day = d.getDate();

                        return this.calllogapi.forDate(year, month, day);
                    }),
                    mergeMap(logs => {
                        return forkJoin({
                            logs: of(logs),
                            numbers: this.customerapi.search({
                                phone: Array.from(
                                    logs.reduce((res: Set<string>, l: CallLog) => {
                                        res.add(l.caller);
                                        return res;
                                    }, new Set<string>())
                                ),
                            }).pipe(catchError(err => {
                                console.log(err);
                                return of([]);
                            }))
                        })
                    })
                )
                .subscribe(logs => {
                    let lm = new Map<string, Customer>();
                    logs.numbers.forEach(cust => cust.phoneNumbers.forEach(number => {
                        number = number.replace(" ", "")
                        if (number === "") {
                            return
                        }

                        lm.set(number, cust)
                    }))

                    console.log(lm);

                    this.logs = logs.logs.map(l => {
                        const cust = lm.get(l.caller);
                        return {
                            ...l,
                            localDate: new Date(l.date).toLocaleString(),
                            customer: cust,
                        };
                    });
                })

        this.subscriptions.add(sub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}