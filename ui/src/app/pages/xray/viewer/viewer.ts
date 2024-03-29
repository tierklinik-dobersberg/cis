import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import * as dwv from 'dwv';
import { Subscription } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { DxrService, Series, Study } from 'src/app/api';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { DwvService } from './viewer.service';

@Component({
  templateUrl: './viewer.html',
  styleUrls: ['./viewer.scss'],
})
export class ViewerComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  private id = '';

  readonly getUrl = this.dxrService.getThumbnailUrl;

  dwvApp: any | null = null;
  study: Study | null = null;
  series: Series | null = null;
  loadProgress = 0;
  selectedTool = '';
  currentInstanceUid = '';

  constructor(
    private header: HeaderTitleService,
    private dwvService: DwvService,
    private dxrService: DxrService,
    private activatedRoute: ActivatedRoute,
    private elementRef: ElementRef,
    private changeDetector: ChangeDetectorRef,
    private breakpointObserver: BreakpointObserver,
  ) { }

  get element(): ElementRef {
    return this.elementRef;
  }

  rotate(amount: number): void {
    this.dwvApp.translate(amount, 0);
  }

  async selectTool(tool: string, shape?: string): Promise<void> {
    this.selectedTool = tool;
    this.dwvApp.setTool(tool);

    if (tool === 'Draw' && !!shape) {
      this.dwvApp.setDrawShape(shape);
    }
  }

  getImageUrl(wadoURI: string): string {
    return wadoURI.replace('dicomweb://', '//'); // + '&contentType=image/jpeg';
  }

  ngOnInit(): void {
    this.subscriptions = new Subscription();
    this.id = this.dwvService.register(this);

    this.dwvApp = new dwv.App();
    this.dwvApp.init({
      containerDivId: `dwv/${this.id}`,
      tools: {
        Draw: {
          options: ['Rectangle', 'Ellipse', 'Ruler', 'Arrow', 'Protractor', 'FreeHand'],
          type: 'factory',
        },
        WindowLevel: {},
        ZoomAndPan: {},
        Scroll: {},
        Floodfill: {},
        Livewire: {}
      },
      isMobile: this.breakpointObserver.isMatched('(max-width: 900)'),
      useWebWorkers: true,
    });

    this.dwvApp.addEventListener('load-progress', event => {
      this.displayProgress(event.total);
    });

    this.dwvApp.addEventListener('load-end', event => {
      this.loadProgress = 101;
    });

    const routeSubscription = this.activatedRoute.paramMap
      .pipe(
        mergeMap(params => {
          return this.dxrService.loadStudy(params.get('studyID'))
            .pipe(
              map(study => {
                return [params.get('seriesID'), params.get('instanceID'), study];
              })
            );
        }),
      )
      .subscribe({
        next: ([seriesID, instanceID, response]: [string, string, { studies: Study[] }]) => {
          const study = response.studies[0];
          this.loadProgress = 0;

          this.header.set(`${study.patientName} - ${study.animalName}`, `Röntgen Aufnahmen vom ${study.studyDate} ${study.studyTime || ''} ${study.animalRace ? ' - ' + study.animalRace : ''}`);
          this.study = study;
          this.series = study.seriesList.find(s => s.seriesInstanceUid === seriesID);

          this.currentInstanceUid = instanceID;

          const imageUrl = this.getImageUrl(this.series.instances.find(i => i.sopInstanceUid === instanceID).url);
          this.dwvApp.loadURLs([imageUrl]);
          this.changeDetector.detectChanges();

        },
        error: err => console.error(err),
      });

    this.subscriptions.add(routeSubscription);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.dwvService.unregister(this.id);

    // abort loading if there's anything in progress
    if (!!this.dwvApp) {
      this.dwvApp.abortLoad();
      this.dwvApp.resetLayout();
      this.dwvApp.reset();
      this.dwvApp = null;
    }
  }

  displayProgress(percent: number): void {
    this.loadProgress = percent;
    this.changeDetector.detectChanges();
  }
}

