import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, combineLatest, forkJoin, Observable, of, Subject, throwError } from "rxjs";
import { catchError, debounceTime, filter, map, mergeMap, takeUntil } from "rxjs/operators";
import { InfoScreenAPI, Layout, Show, Slide, Vars } from "src/app/api/infoscreen.api";
import { HeaderTitleService } from "src/app/shared/header-title";

import * as ClassicEditor from 'ckeditor/build/ckeditor';
import { NzModalRef, NzModalService } from "ng-zorro-antd/modal";
import { HttpErrorResponse } from "@angular/common/http";

interface SlideModel extends Slide {
  preview: SafeResourceUrl;
}

interface ShowModel extends Show {
  slides: SlideModel[];
}

interface Theme {
  value: string;
  name: string;
}

@Component({
  selector: 'app-infoscreen-show-editor',
  templateUrl: './show-editor.html',
  styleUrls: ['./show-editor.scss'],
})
export class ShowEditorComponent implements OnInit, OnDestroy {
  private _destroy$ = new Subject<void>();

  public Editor = ClassicEditor;

  @ViewChild('layoutSelector')
  layoutSelectorTemplate: TemplateRef<any>;

  readonly themes: Theme[] = [
    { name: "Beige", value: "beige" },
    { name: "Black", value: "black" },
    { name: "Blood", value: "blood" },
    { name: "League", value: "league" },
    { name: "Moon", value: "moon" },
    { name: "Night", value: "night" },
    { name: "Serif", value: "serif" },
    { name: "Simple", value: "simple" },
    { name: "Sky", value: "sky" },
    { name: "Solarized", value: "solarized" },
    { name: "White", value: "white" }
  ]

  show: ShowModel | null = null;

  config = {
    toolbar: ['heading', '|', 'fontColor', 'bold', 'italic', 'link', 'bulletedList', 'numberedList'],
  }

  currentSlideIndex: number = -1;
  currentSlide: SlideModel | null = null;
  layoutPreview: SafeResourceUrl | null = null;
  layouts: { [key: string]: Layout } = {};
  unsaved = false;
  currentSlideUnsaved = false;
  refreshPending = false;

  private _updatePreview$ = new Subject<void>();
  private _reload$ = new BehaviorSubject<void>(undefined);

  constructor(
    private headerService: HeaderTitleService,
    private activeRoute: ActivatedRoute,
    public showAPI: InfoScreenAPI,
    private dialog: NzModalService,
    private domSanitizer: DomSanitizer,
  ) { }

  ngOnInit() {
    this.headerService.set('Slide-Show')

    this._updatePreview$.pipe(
      takeUntil(this._destroy$),
      debounceTime(500),
      filter(() => !!this.currentSlide),
      mergeMap(() => {
        return this.showAPI.previewLayoutUrl(this.currentSlide, {
          theme: this.show.theme || 'white',
        })
      })
    ).subscribe(url => {
      this.layoutPreview = url;
      this.refreshPending = false;
    })

    this.showAPI.listLayouts()
      .pipe(
        takeUntil(this._destroy$),
        mergeMap(layoutNames => forkJoin(layoutNames.map(l => this.showAPI.getLayout(l))))
      )
      .subscribe(layouts => {
        layouts.forEach(l => {
          this.layouts[l.name] = l;
        })
      })

    let show$ = this.activeRoute.paramMap
      .pipe(
        map(params => params.get('show')),
      );

    combineLatest([show$, this._reload$])
      .pipe(
        takeUntil(this._destroy$),
        mergeMap(([show]) => this.showAPI.getShow(show)),
      )
      .subscribe(show => {
        this.show = {
          ...show,
          theme: show.theme || 'white',
          description: show.description || '',
          slides: show.slides?.map((slide, idx) => ({
            ...slide,
            preview: this.showAPI.previewSlideUrl(show.name, idx)
          })) || []
        };
        this.unsaved = false;
        this.currentSlideUnsaved = false;

        if (!!this.show.slides) {
          this.openSlide(this.show.slides[0], 0)
        }

        this.headerService.set('Slide-Show: ' + show.name);
      })
  }

  updatePreview() {
    if (!this.currentSlide) {
      return;
    }

    this.unsaved = true;
    this.currentSlideUnsaved = true;
    this.refreshPending = true;
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
      this.showAPI.saveShow(show)
        .subscribe(() => {
          this._reload$.next();
        })
    } else {
      window.open(this.showAPI.playUrlString(this.show.name))
    }
  }

  layoutSelectorRef: NzModalRef<any> | null = null;
  selectLayout() {
    this.layoutSelectorRef = this.dialog.create({
      nzTitle: "Bitte wähle ein Layout",
      nzContent: this.layoutSelectorTemplate,
      nzFooter: null,
      nzWidth: "600px",
    })
  }

  async onLayoutSelected(layout: string) {
    if (!!this.layoutSelectorRef) {
      this.layoutSelectorRef.close();
    }
    const slide: SlideModel = {
      layout: layout,
      preview: '',
      vars: {}
    }

    this.layouts[layout].variables.forEach(variable => {
      let def: any;
      switch (variable.type) {
        case "string": def = ''; break;
        case "number": def = 0; break;
        case 'boolean': def = false; break;
        case "stringlist": def = []; break;
      }
      // if there's only a limited set of allowed values we
      // use the first one as the default since "" might not be
      // allowed.
      if (!!variable.choices) {
        def = variable.choices[0];
      }
      slide.vars[variable.name] = def;
    })

    slide.preview = await this.showAPI.previewLayoutUrl(slide, { theme: this.show.theme }).toPromise();

    this.show.slides.push(slide)
    this.openSlide(slide, this.show.slides.length - 1, true)
    this.unsaved = true;
  }

  deleteSlide(index: number) {
    this.dialog.confirm({
      nzTitle: "Folie löschen?",
      nzContent: "Soll die Folie wirklich gelöscht werden?",
      nzOnOk: () => {
        this.show.slides.splice(index, 1);
        this.unsaved = true;

        if (index === this.currentSlideIndex) {
          this.currentSlide = null;
          this.currentSlideIndex = -1;
          this.layoutPreview = '';

        } else if (this.currentSlideIndex > index) {

          this.currentSlideIndex--;
          this.currentSlide = this.show.slides[this.currentSlideIndex] || null;

        }
      }
    })
  }

  handleUnsaved(ignoreChanges: boolean, next: () => void): boolean {
    if (this.unsaved && !ignoreChanges) {
      this.dialog.confirm({
        nzTitle: "Änderungen verwerfen?",
        nzContent: "Es sind nicht gespeicherte Änderungen vorhanden. Sollen diese verworfen werden?",
        nzOkText: 'Ja, verwerfen',
        nzCancelText: 'Nein',
        nzOnOk: next,
      })
      return true;
    }
    return false
  }

  async openSlide(slide: SlideModel, idx: number, ignoreChanges = false) {
    if (!slide) {
      return;
    }

    if (this.currentSlideUnsaved && !!this.currentSlide) {
      // update the preview link of the current slide.
      this.currentSlide.preview = await this.showAPI.previewLayoutUrl(this.currentSlide, { theme: this.show.theme }).toPromise();
    }

    this.currentSlide = slide;
    this.currentSlideIndex = idx;
    this.currentSlideUnsaved = true;
    this._updatePreview$.next();
  }
}
