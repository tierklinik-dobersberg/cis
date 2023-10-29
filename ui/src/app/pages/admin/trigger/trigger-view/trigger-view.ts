import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TrackByFunction,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of, Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import {
  ActionDef,
  ActionType,
  OptionSpec,
  TriggerAPI,
  TriggerInstance,
} from 'src/app/api';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage } from 'src/app/utils';
import { EditActionComponent } from '../edit-action';

@Component({
  templateUrl: './trigger-view.html',
  styleUrls: ['./trigger-view.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TriggerViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  matchSpec: OptionSpec[] = [];

  trigger = emptyTrigger();

  actionTypes: {
    [key: string]: string;
  } = {};

  availableActions: ActionType[] = [];

  trackAction: TrackByFunction<ActionDef> = (
    idx: number,
    action: ActionDef
  ) => {
    return action.id || idx;
  };

  constructor(
    private headerTitleService: HeaderTitleService,
    private triggerAPI: TriggerAPI,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private nzModal: NzModalService,
    private router: Router,
    private nzMessageService: NzMessageService
  ) {}

  ngOnInit(): void {
    this.triggerAPI
      .matchSpec()
      .pipe(takeUntil(this.destroy$))
      .subscribe((matchSpec) => {
        this.matchSpec = matchSpec;
        this.cdr.markForCheck();
      });

    this.triggerAPI
      .listActionTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe((types) => {
        this.availableActions = types;
        this.actionTypes = {};
        this.availableActions.forEach((action) => {
          this.actionTypes[action.name.toLowerCase()] = action.description;
        });

        this.cdr.markForCheck();
      });

    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          const instanceID = params.get('name');
          if (instanceID === 'create') {
            return of(null as TriggerInstance);
          }

          return this.triggerAPI.getTrigger(instanceID);
        })
      )
      .subscribe((instance) => {
        this.cdr.markForCheck();

        if (instance === null) {
          this.headerTitleService.set(
            'Neue Event-Integration erstellen',
            'Erstelle einen Aktions-Trigger.',
            null,
            [
              { name: 'Administration', route: '/admin' },
              { name: 'Trigger & Integrationen', route: '/admin/trigger' },
            ]
          );

          this.trigger = {
            ...emptyTrigger(),
          };

          return;
        }

        this.trigger = instance;

        this.headerTitleService.set(
          'Integration bearbeiten',
          'Bearbeite eine existierende Event-Integration',
          null,
          [
            { name: 'Administration', route: '/admin' },
            { name: 'Trigger & Integrationen', route: '/admin/trigger' },
          ]
        );
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  saveTrigger() {
    this.triggerAPI.putTrigger(this.trigger).subscribe({
      next: (id) => {
        this.nzMessageService.success('Trigger wurde erfolgreich erstellt');
        this.router.navigate(['..', id], {relativeTo: this.route})
      },
      error: (err) =>
        this.nzMessageService.error(
          extractErrorMessage(err, 'Trigger konnte nicht erstellt werden')
        ),
    });
  }

  deleteAction(idx: number) {
    this.trigger.actions.splice(idx, 1);
    this.trigger.actions = [...this.trigger.actions];
  }

  /** @private - add a new action to the trigger */
  addOrEditAction(idx?: number, action?: ActionDef) {
    this.nzModal.create({
      nzContent: EditActionComponent,
      nzTitle: 'Aktion hinzufügen',
      nzCloseOnNavigation: true,
      nzMaskClosable: true,
      nzWidth: null,
      nzClassName: 'w-1/2',
      nzOkText: 'Hinzufügen',
      nzData: {
        availableTypes: this.availableActions,
        selectedActionType: this.availableActions.find(
          (type) => type.name.toLowerCase() === action?.type?.toLowerCase()
        ),
        config: action?.options || {},
      },
      nzOnOk: (cmp) => {
        const newAction = {
          id: '',
          options: cmp.config,
          type: cmp.selectedActionType.name.toLowerCase(),
        };

        if (idx !== undefined) {
          this.trigger.actions[idx] = newAction;
          this.trigger.actions = [...this.trigger.actions];
        } else {
          this.trigger.actions = [...this.trigger.actions, newAction];
        }

        console.log(this.trigger);

        this.cdr.markForCheck();
      },
      nzOnCancel: () => {},
    });
  }
}

function emptyTrigger(): TriggerInstance {
  return {
    actions: [],
    config: {
      Name: '',
    },
    id: '',
    pending: false,
  };
}
