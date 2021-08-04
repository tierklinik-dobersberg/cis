import { Component, OnDestroy, OnInit } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { forkJoin, Observable, of, Subject } from "rxjs";
import { map, mergeMap, takeUntil } from "rxjs/operators";
import { InfoScreenAPI, Layout, Show, Slide, Vars } from "src/app/api/infoscreen.api";
import { HeaderTitleService } from "src/app/shared/header-title";

import * as ClassicEditor from 'ckeditor/build/ckeditor';

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

  public Editor = ClassicEditor;

  show: ShowModel | null = null;

  config = {
    toolbar: ['heading', '|', 'fontColor', 'bold', 'italic', 'link', 'bulletedList', 'numberedList'],
  }

  currentSlideIndex: number = -1;
  currentSlide: Slide | null = null;
  layoutPreview: Observable<SafeResourceUrl> | null = null;
  layoutVars: Vars = {};
  layouts: { [key: string]: Layout } = {};

  constructor(
    private headerService: HeaderTitleService,
    private activeRoute: ActivatedRoute,
    public showAPI: InfoScreenAPI,
  ) { }

  ngOnInit() {
    this.headerService.set('Slide-Show')

    const allLayouts$ = this.showAPI.listLayouts()
      .pipe(
        mergeMap(layoutNames => forkJoin(layoutNames.map(l => this.showAPI.getLayout(l))))
      )
      .subscribe(layouts => {
        console.log(layouts);
        layouts.forEach(l => {
          this.layouts[l.name] = l;
        })
      })

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

  updatePreview() {
    const slide = {
      ...this.currentSlide,
      vars: this.layoutVars,
    }
    this.layoutPreview = this.showAPI.previewLayoutUrl(slide)
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
    this.layoutPreview = this.showAPI.previewLayoutUrl(slide)
  }
}
