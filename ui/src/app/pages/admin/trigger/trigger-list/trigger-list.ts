import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { BehaviorSubject, Subject } from "rxjs";
import { switchMap, takeUntil } from "rxjs/operators";
import { TriggerAPI, TriggerInstance } from "src/app/api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { extractErrorMessage } from "src/app/utils";

@Component({
  templateUrl: './trigger-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TriggerListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private reload$ = new BehaviorSubject<void>(undefined);

  triggers: TriggerInstance[] = [];

  trackInstance: TrackByFunction<TriggerInstance> = (_: number, instance: TriggerInstance) => instance.id;

  constructor(
    private headerTitleService: HeaderTitleService,
    private triggerAPI: TriggerAPI,
    private nzMessageService: NzMessageService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.headerTitleService.set(
      'Trigger & Integrationen',
      'Verwalte automatische Aktionen und Integrationen mit externen Systemen',
      null,
      [
        {name: 'Administration', route: '/admin'}
      ]
    )

    this.reload$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.triggerAPI.listInstances())
      )
      .subscribe(instances => {
        this.triggers = instances || [];
        this.cdr.markForCheck();
      })
  }

  editTrigger(id: string) {
    this.router.navigate([id], {relativeTo: this.route})
  }

  deleteTrigger(id: string) {
    this.triggerAPI.deleteTrigger(id)
      .subscribe({
        next: () => {
          this.nzMessageService.success('Trigger wurde erfolgreich gelöscht');
          this.reload$.next();
        },
        error: err => this.nzMessageService.error(extractErrorMessage(err, 'Trigger konnte nicht gelöscht werden'))
      })
  }

  ngOnDestroy(): void {
      this.destroy$.next();
      this.destroy$.complete();
      this.reload$.complete();
  }
}
