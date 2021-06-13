import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, forkJoin, interval, Observable, Subject } from 'rxjs';
import { delay, distinctUntilChanged, map, mergeMap, retry, retryWhen, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { ConfigAPI, TriggerAction, TriggerAPI, TriggerInstance } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';

interface Action extends TriggerAction {
    trigger: TriggerInstance;
    running: boolean;
}

@Component({
    selector: 'app-trigger-action-card',
    templateUrl: './trigger-action-card.html',
    styleUrls: ['./trigger-action-card.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TriggerActionCardComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject<void>();
    private reload$ = new BehaviorSubject<void>(undefined);

    actions: Action[] = [];

    constructor(
        private triggerapi: TriggerAPI,
        private config: ConfigAPI,
        private nzMessageService: NzMessageService,
        private cdr: ChangeDetectorRef,
    ) { }

    ngOnInit() {
        let loadTriggers = interval(5000)
            .pipe(
                startWith(-1),
                switchMap(() => this.triggerapi.listInstances())
            );

        combineLatest([
            this.config.change,
            loadTriggers,
            this.reload$,
        ])
            .pipe(
                takeUntil(this.destroy$),
                distinctUntilChanged(),
                retryWhen(err => {
                    console.error(err);
                    return err.pipe(delay(1000))
                })
            )
            .subscribe(cfg => {
                let instances = new Map<string, TriggerInstance>();
                cfg[1].forEach(i => instances.set(stripTriggerSuffix(i.name), i));

                this.actions = [];
                cfg[0].TriggerActions?.forEach(a => {
                    this.actions.push({
                        ...a,
                        trigger: instances.get(stripTriggerSuffix(a.PrimaryTrigger)),
                        running: false,
                    })
                });
                console.log(this.actions);
                this.cdr.markForCheck();
            })
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    executeAction(action: Action) {
        action.running = true;
        let exec: Observable<any>;
        if (!action.TriggerGroup || action.TriggerGroup?.length == 0) {
            exec = this.triggerapi.executeInstance(action.trigger.name);
        } else {
            exec = forkJoin(action.TriggerGroup.map(grp => {
                return this.triggerapi.executeGroup(grp)
            }))
        }
        exec.subscribe({
            next: () => {
                this.nzMessageService.success('Aktion ' + action.Name + ' gestartet')
                this.reload$.next();
            },
            error: err => {
                this.reload$.next();
                this.nzMessageService.error(extractErrorMessage(err, action.Name + " fehlgeschlagen"))
                action.running = false;
            },
            complete: () => {
                action.running = false;
            }
        })
    }
}
function stripTriggerSuffix(name: string): string {
    return name.replace(/\.trigger$/, '')
}

