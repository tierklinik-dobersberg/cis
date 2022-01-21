import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Observable, ObservedValueOf, of, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';

@Component({
    selector: 'tkd-counter',
    templateUrl: './counter.html',
    styleUrls: ['./counter.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CounterStatComponent implements OnChanges, OnInit, OnDestroy {
    private reload$ = new Subject<void>();
    private destroy$ = new Subject<void>(); 

    @Input()
    title: string = '';

    @Input()
    description: string = '';

    @Input()
    load: () => Observable<number> = () => of(0);

    @Input()
    count: number = 0;

    ngOnInit() {
        this.reload$
            .pipe(
                takeUntil(this.destroy$),
                switchMap(() => this.load())
            )
            .subscribe(counter => this.count = counter)
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnChanges(changes: SimpleChanges) {
        if ('load' in changes) {
            this.reload$.next()
        }
    }
}