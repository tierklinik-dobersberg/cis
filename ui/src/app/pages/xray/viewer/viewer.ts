import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { DxrService, Series, Study } from "src/app/api";
import { DwvService, Tool } from "./viewer.service";
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import * as dwv from 'dwv';
import { map, mergeMap, take } from "rxjs/operators";

@Component({
    templateUrl: './viewer.html',
    styleUrls: ['./viewer.scss'],
})
export class ViewerComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;

    private id: string = '';

    readonly getUrl = this.dxrService.getThumbnailUrl;

    dwvApp: any | null = null;
    study: Study | null = null;
    series: Series | null = null;
    loadProgress: number = 0;
    selectedTool: string = '';
    currentInstanceUid: string = '';

    constructor(
        private dwvService: DwvService,
        private dxrService: DxrService,
        private activatedRoute: ActivatedRoute,
        private elementRef: ElementRef,
        private changeDetector: ChangeDetectorRef,
        private breakpointObserver: BreakpointObserver,
    ) { }

    get element() {
        return this.elementRef;
    }

    rotate(amount: number) {
        this.dwvApp.translate(amount, 0);
    }

    async selectTool(tool: string, shape?: string) {
        this.selectedTool = tool;
        this.dwvApp.setTool(tool)

        if (tool === 'Draw') {
            this.dwvApp.setDrawShape(shape!)
        }
    }

    getImageUrl(wadoURI: string): string {
        return wadoURI.replace('dicomweb://', '//'); // + '&contentType=image/jpeg';
    }

    ngOnInit() {
        this.subscriptions = new Subscription();
        this.id = this.dwvService.register(this);

        this.breakpointObserver.observe('')

        this.dwvApp = new dwv.App();
        this.dwvApp.init({
            containerDivId: `dwv/${this.id}`,
            tools: {
                'Draw': {
                    options: ['Rectangle', 'Ellipse', 'Ruler', 'Arrow', 'Protractor', 'FreeHand'],
                    type: 'factory',
                },
                'WindowLevel': {},
                'ZoomAndPan': {},
                'Scroll': {},
                'Floodfill': {},
                'Livewire': {}
            },
            isMobile: this.breakpointObserver.isMatched('(max-width: 900)'),
            useWebWorkers: true,
        });

        this.dwvApp.addEventListener('load-progress', event => {
            this.displayProgress(event.total);
        })

        this.dwvApp.addEventListener('load-end', event => {
            this.loadProgress = 101;
        })

        const routeSubscription = this.activatedRoute.paramMap
            .pipe(
                mergeMap(params => {
                    return this.dxrService.loadStudy(params.get('studyID'))
                        .pipe(
                            map(study => {
                                return [params.get('seriesID'), params.get('instanceID'), study]
                            })
                        )
                }),
            )
            .subscribe({
                next: ([seriesID, instanceID, response]: [string, string, { studies: Study[] }]) => {
                    const study = response.studies[0];
                    this.loadProgress = 0;

                    this.study = study;
                    this.series = study.seriesList.find(s => s.seriesInstanceUid === seriesID);
                    console.log(this.series);

                    this.currentInstanceUid = instanceID;

                    const imageUrl = this.getImageUrl(this.series.instances.find(i => i.sopInstanceUid == instanceID).url);
                    this.dwvApp.loadURLs([imageUrl]);
                    this.changeDetector.detectChanges();

                },
                error: err => console.error(err),
            });

        this.subscriptions.add(routeSubscription)
    }

    ngOnDestroy() {
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

    displayProgress(percent: number) {
        this.loadProgress = percent;
        console.log(this.loadProgress);
        this.changeDetector.detectChanges();
    }
}

