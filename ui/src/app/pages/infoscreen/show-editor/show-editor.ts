import { Component, OnDestroy, OnInit } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { Subject } from "rxjs";
import { map, mergeMap, takeUntil } from "rxjs/operators";
import { InfoScreenAPI, Show, Slide, Vars } from "src/app/api/infoscreen.api";
import { HeaderTitleService } from "src/app/shared/header-title";

interface SlideModel extends Slide {
  preview: SafeResourceUrl;
}

interface ShowModel extends Show {
  slides: SlideModel[];
}

@Component({
  selector: 'app-infoscreen-show-editor',
  templateUrl: './show-editor.html',
  styleUrls: ['./show-editor.scss'],
})
export class ShowEditorComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<void>();

  show: ShowModel | null = null;

  currentSlideIndex: number = -1;
  currentSlide: Slide | null = null;
  layoutPreview: SafeResourceUrl | null = null;
  layoutVars: Vars = {};

  constructor(
    private headerService: HeaderTitleService,
    private activeRoute: ActivatedRoute,
    public showAPI: InfoScreenAPI,
  ) { }

  ngOnInit() {
    this.headerService.set('Slide-Show')

    this.activeRoute.paramMap
      .pipe(
        takeUntil(this._destroy$),
        map(params => params.get('show')),
        mergeMap(show => this.showAPI.getShow(show)),
      )
      .subscribe(show => {
        this.show = {
          ...show,
          slides: show.slides.map((slide, idx) => ({
            ...slide,
            preview: this.showAPI.previewSlideUrl(show.name, idx)
          }))
        };

        if (!!this.show.slides) {
          this.openSlide(this.show.slides[0], 0)
        }

        this.headerService.set('Slide-Show: ' + show.name);
      })
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }

  openSlide(slide: Slide, idx: number) {
    this.currentSlide = slide;
    this.currentSlideIndex = idx;

    this.layoutVars = {
      ...slide.vars,
    }
    this.layoutPreview = this.showAPI.previewSlideUrl(this.show!.name, idx)
  }
}
