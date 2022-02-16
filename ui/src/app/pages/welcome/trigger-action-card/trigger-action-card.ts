import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, forkJoin, interval, Observable, of, Subject } from 'rxjs';
import { delay, distinctUntilChanged, retryWhen, startWith, switchMap, takeUntil, tap } from 'rxjs/operators';
import { ConfigAPI, IdentityAPI, Permissions, PermissionRequest, PermissionTestResult, TriggerAction, TriggerAPI, TriggerInstance } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';

interface Action extends TriggerAction {
  trigger: TriggerInstance;
  running: boolean;
  canExecute: boolean;
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

  trackAction: TrackByFunction<Action> = (_: number, a: Action) => a.Name;

  constructor(
    private triggerapi: TriggerAPI,
    private config: ConfigAPI,
    private identityapi: IdentityAPI,
    private nzMessageService: NzMessageService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    let checkedPermissions = new Set<string>();
    let cachedPermissionResponse: { [key: string]: PermissionTestResult } | null = null;

    let loadTriggers = interval(5000)
      .pipe(
        startWith(-1),
        switchMap(() => this.triggerapi.listInstances()),
        switchMap(triggers => {
          const permRequest: { [key: string]: PermissionRequest } = {};
          let foundUnchecked = false;
          const newCheckedPermissions = new Set<string>();
          triggers.forEach(instance => {
            const name = stripTriggerSuffix(instance.name)
            if (!checkedPermissions.has(name)) {
              foundUnchecked = true;
            }
            newCheckedPermissions.add(name)
            permRequest[name] = {
              action: Permissions.TriggerExecute,
            }
          })
          let findExecutables = this.identityapi.testPerimissions(permRequest)
            .pipe(
              tap(result => {
                checkedPermissions = newCheckedPermissions;
                cachedPermissionResponse = result
              })
            )
          if (!foundUnchecked) {
            findExecutables = of(cachedPermissionResponse!)
          }

          return forkJoin({
            triggers: of(triggers),
            allowed: findExecutables,
          })
        })
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
        cfg[1].triggers.forEach(i => instances.set(stripTriggerSuffix(i.name), i));

        this.actions = [];
        cfg[0].TriggerAction?.forEach(a => {
          const name = stripTriggerSuffix(a.PrimaryTrigger)
          this.actions.push({
            ...a,
            trigger: instances.get(name),
            running: false,
            // if we don't have a primary trigger we cannot know if it's already pending.
            // moreover, we cannot easily test if the user can execute the trigger group (we would need
            // to test each trigger of the group separately). Since the backend does know
            // we just default to "allow" here. The user will be prompted with an error anyway
            // if all triggers are denied.
            canExecute: cfg[1]?.allowed[name]?.allowed || true,
          })
        });
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

