import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { Subject } from "rxjs";
import { InfoScreenAPI, ListShowEntry } from "src/app/api/infoscreen.api";
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
    private headerService: HeaderTitleService
  ) { }

  ngOnInit() {
    this.headerService.set('Info-Screen Slide-Shows')
    this.showAPI.listShows()
      .subscribe(shows => {
        this.shows = shows.map(s => {
          return {
            ...s,
            preview: this.showAPI.previewSlideUrl(s.name, 0),
            previewUrl: this.showAPI.previewSlideUrl(s.name, 0),
            playUrl: this.showAPI.playUrl(s.name)
          }
        });
      })
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
