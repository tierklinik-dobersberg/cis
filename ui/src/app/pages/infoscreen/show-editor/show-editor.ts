import { Component, OnDestroy, OnInit } from "@angular/core";
import { SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, combineLatest, forkJoin, Observable, of, Subject } from "rxjs";
import { debounceTime, map, mergeMap, takeUntil } from "rxjs/operators";
import { InfoScreenAPI, Layout, Show, Slide, Vars } from "src/app/api/infoscreen.api";
import { HeaderTitleService } from "src/app/shared/header-title";

import * as ClassicEditor from 'ckeditor/build/ckeditor';
import { NzModalService } from "ng-zorro-antd/modal";

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
  layoutPreview: SafeResourceUrl | null = null;
  layoutVars: Vars = {};
  layouts: { [key: string]: Layout } = {};
  unsaved = false;

  private _updatePreview$ = new Subject<void>();
  private _reload$ = new BehaviorSubject<void>(undefined);

  constructor(
    private headerService: HeaderTitleService,
    private activeRoute: ActivatedRoute,
    public showAPI: InfoScreenAPI,
    private dialog: NzModalService,
  ) { }

  ngOnInit() {
    this.headerService.set('Slide-Show')

    this._updatePreview$.pipe(
      takeUntil(this._destroy$),
      debounceTime(500),
      mergeMap(() => {
        const slide = {
          ...this.currentSlide,
          vars: this.layoutVars,
        }
        return this.showAPI.previewLayoutUrl(slide)
      })
    ).subscribe(url => this.layoutPreview = url)

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

    let show$ = this.activeRoute.paramMap
      .pipe(
        takeUntil(this._destroy$),
        map(params => params.get('show')),
        mergeMap(show => this.showAPI.getShow(show)),
      );

    combineLatest([show$, this._reload$])
      .subscribe(([show]) => {
        this.show = {
          ...show,
          slides: show.slides.map((slide, idx) => ({
            ...slide,
            preview: this.showAPI.previewSlideUrl(show.name, idx)
          }))
        };
        this.unsaved = false;

        if (!!this.show.slides) {
          this.openSlide(this.show.slides[0], 0)
        }

        this.headerService.set('Slide-Show: ' + show.name);
      })
  }

  updatePreview() {
    this.unsaved = true;
    this._updatePreview$.next();
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }

  saveOrPlay() {
    if (this.unsaved) {
      let show: Show = {
        ...this.show,
      }
      show.slides[this.currentSlideIndex] = {
        ...this.currentSlide,
        vars: this.layoutVars,
      }
      this.showAPI.saveShow(show)
        .subscribe(() => {
          this._reload$.next();
        })
    } else {

    }
  }

  openSlide(slide: Slide, idx: number, ignoreChanges = false) {
    if (this.unsaved && !ignoreChanges) {
      this.dialog.confirm({
        nzTitle: "Änderungen verwerfen?",
        nzContent: "Es sind nicht gespeicherte Änderungen vorhanden. Sollen diese verworfen werden?",
        nzOkText: 'Ja, verwerfen',
        nzCancelText: 'Nein',
        nzOnOk: () => {
          this.openSlide(slide, idx, true);
        },
      })
      return
    }
    this.currentSlide = slide;
    this.currentSlideIndex = idx;
    this.unsaved = false;
    this.layoutVars = {
      ...slide.vars,
    }
    this._updatePreview$.next();
  }
}
