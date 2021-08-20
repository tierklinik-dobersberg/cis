import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, TemplateRef, TrackByFunction, ViewChild } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { NzModalRef, NzModalService } from "ng-zorro-antd/modal";
import { Subject } from "rxjs";
import { take } from "rxjs/operators";
import { IdentityAPI, Permission } from "src/app/api";
import { InfoScreenAPI, ListShowEntry } from "src/app/api/infoscreen.api";
import { LayoutService } from "src/app/services";
import { HeaderTitleService } from "src/app/shared/header-title";

interface ShowModel extends ListShowEntry {
  preview: SafeResourceUrl;
  previewUrl: SafeResourceUrl;
  playUrl: SafeResourceUrl;
}

@Component({
  selector: 'app-infoscreen-show-list',
  templateUrl: './show-list.html',
  styleUrls: ['./show-list.scss'],
})
export class ShowListComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<void>();

  shows: ShowModel[] = [];

  trackShow: TrackByFunction<ShowModel> = (_: number, show: ShowModel) => show.name;

  constructor(
    private showAPI: InfoScreenAPI,
    private headerService: HeaderTitleService,
    private nzModal: NzModalService,
    private router: Router,
    public layout: LayoutService,
    private identity: IdentityAPI,
  ) { }

  get canEditShows() {
    return this.identity.hasPermission(Permission.InfoScreenShowWrite)
  }

  get canDeleteShows() {
    return this.identity.hasPermission(Permission.InfoScreenShowDelete);
  }

  ngOnInit() {
    this.headerService.set('Info-Screen Slide-Shows');
    this.loadShows();
  }

  private loadShows() {
    this.shows = [];
    this.showAPI.listShows()
      .subscribe(shows => {
        this.shows = shows?.map(s => {
          return {
            ...s,
            preview: this.showAPI.previewSlideUrl(s.name, 0),
            previewUrl: this.showAPI.previewSlideUrl(s.name, 0),
            playUrl: this.showAPI.playUrl(s.name)
          }
        }) || [];
      })
  }

  deleteShow(show: ShowModel) {
    this.nzModal.confirm({
      nzTitle: "Slide-Show löschen?",
      nzContent: `Sicher dass du die Slide-Show "${show.name}" löschen möchtest?`,
      nzOnOk: () => {
        this.showAPI.deleteShow(show.name)
          .subscribe(() => this.loadShows());
      },
      nzOkText: "Löschen",
      nzOkDanger: true,
    })
  }

  @ViewChild('createShow')
  createShowTemplate: TemplateRef<any>;

  newShowName: string = '';

  onShowNameChange() {
    this.createRef.getConfig().nzOkDisabled = this.newShowName === '';
  }

  private createRef: NzModalRef | null = null;
  createNew() {
    this.newShowName = '';

    this.createRef = this.nzModal.create({
      nzTitle: "Neue Show erstellen",
      nzContent: this.createShowTemplate,
      nzOkDisabled: true,
      nzOnOk: () => {
        this.showAPI.saveShow({
          name: this.newShowName,
          slides: [],
        }).subscribe(() => {
          this.router.navigate(['/infoscreen/edit', this.newShowName])
        });
      }
    });

    this.createRef.afterClose.pipe(take(1))
      .subscribe(() => this.createRef = null);
  }

  activate(show: ShowModel) {
    show.preview = show.playUrl;
  }

  deactivate(show: ShowModel) {
    show.preview = show.previewUrl;
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
