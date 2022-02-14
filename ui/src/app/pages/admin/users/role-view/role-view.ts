import { ChangeDetectionStrategy, ChangeDetectorRef, Component, IterableDifferFactory, IterableDiffers, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { forkJoin, Observable, of, Subject } from "rxjs";
import { switchMap, takeUntil } from "rxjs/operators";
import { IdentityAPI, Permission, Role } from "src/app/api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { extractErrorMessage } from "src/app/utils";
import { getOperations } from "../permissions-view";


@Component({
  templateUrl: './role-view.html',
  styleUrls: ['./role-view.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject();

  editMode = false;
  name = '';
  description = '';
  permissions: Permission[] = [];
  originalPermissions: Permission[] = [];

  private iterableDifferFactory: IterableDifferFactory;

  constructor(
    private identityapi: IdentityAPI,
    private headerTitleService: HeaderTitleService,
    private nzMessageService: NzMessageService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    iterableDiffers: IterableDiffers,
  ) {
    this.iterableDifferFactory = iterableDiffers.find([]);
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
      )
      .subscribe(params => {
        const roleName = params.get("role")
        if (!roleName) {
          this.editMode = false;
          this.name = '';
          this.description = '';
          this.permissions = [];
          this.originalPermissions = [];
          this.headerTitleService.set('Erstelle eine neuen Benutzerrolle', 'Benutzerrollen vereinfachen die Verwaltung von Berechtigungen.')
          this.cdr.markForCheck();
        } else {
          this.identityapi.getRole(roleName)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: role => {
                this.name = role.name;
                this.description = role.description;
                this.editMode = true;
                this.permissions = role.permissions || [];
                this.originalPermissions = [...this.permissions];
                this.headerTitleService.set('Bearbeite eine Benutzerrolle', 'Benutzerrollen vereinfachen die Verwaltung von Berechtigungen.')
                this.cdr.markForCheck();
              },
              error: err => {
                this.nzMessageService.error(extractErrorMessage(err, 'Rolle konnte nicht geladen werden'))
                this.router.navigate(['/admin/identiy/roles'])
              }
            })
        }
      })
  }

  private getRole(): Role {
    return {
      name: this.name,
      description: this.description
    }
  }

  saveRole() {
    let updatePermissions: Observable<any> = of(null);
    const changes = getOperations(this.iterableDifferFactory, this.originalPermissions, this.permissions);
    if (!!changes) {
      let observables: Observable<any>[] = [];
      changes.forEachAddedItem(record => {
        observables.push(
          this.identityapi.assignPermission('roles', this.name, record.item)
        );
      })

      changes.forEachRemovedItem(record => {
        if (!record.item.id) {
          return;
        }
        observables.push(
          this.identityapi.unassignPermission('roles', this.name, record.item.id),
        )
      })

      updatePermissions = forkJoin(observables)
    }

    this.identityapi.editRole(this.getRole())
      .pipe(switchMap(() => updatePermissions))
      .subscribe({
        next: () => {
          this.nzMessageService.success("Benutzerrolle erfolgreich gespeichert"),
          this.router.navigate(["/admin/identity/roles"])
        },
        error: err => {
          this.nzMessageService.error(extractErrorMessage(err, 'Rolle konnte nicht gespeichert werden'))
        }
      })
  }

  createRole() {
    this.identityapi.createRole(this.getRole())
      .subscribe({
        next: () => {
          this.nzMessageService.success("Benutzerrolle erfolgreich erstellt")
          this.router.navigate(["/admin/identity/roles/edit", this.name ])
        },
        error: err => {
          this.nzMessageService.error(extractErrorMessage(err, 'Rolle konnte nicht erstellt werden'))
        }
      })
  }

  deleteRole() {
    this.identityapi.deleteRole(this.name)
      .subscribe({
        next: () => {
          this.nzMessageService.success("Benutzerrolle erfolgreich gelöscht.")
          this.router.navigate(["/admin/identity/roles"])
        },
        error: err => this.nzMessageService.error(extractErrorMessage(err, 'Rolle konnte nicht gelöscht werden'))
      })
  }

  ngOnDestroy(): void {
      this.destroy$.next();
      this.destroy$.complete();
  }
}
