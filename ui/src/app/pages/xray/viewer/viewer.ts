import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { DxrService, Series, Study } from "src/app/api";
import { DwvService, Tool } from "./viewer.service";
import * as dwv from 'dwv';
import { flatMap, map, mergeMap, take } from "rxjs/operators";

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

    readonly toolButtons: ReadonlyArray<Tool> = [
        {
            label: 'Zeichnen / Messen',
            icon: 'create',
            id: 'Draw',
        },
        {
            label: 'Zoom/Move',
            icon: 'move',
            id: 'ZoomAndPan'
        },
        {
            label: 'Window Level',
            icon: 'switch',
            id: 'WindowLevel'
        }
    ];

    constructor(
        private dwvService: DwvService,
        private dxrService: DxrService,
        private activatedRoute: ActivatedRoute,
        private elementRef: ElementRef,
        private changeDetector: ChangeDetectorRef,
    ) { }

    get element() {
        return this.elementRef;
    }

    async selectTool(tool: Tool) {
        /*
        if (tool.id == 'Draw') {
            const sheet = await this.actionController.create({
                header: 'Form / Messung',
                buttons: this.shapes,
            });

            sheet.present()
            const result = await sheet.onDidDismiss();

            if (result.role === 'backdrop') {
                return;
            }

            this.selectedTool = tool.id;
            this.dwvApp.onChangeTool({ currentTarget: { value: tool.id } })
            this.dwvApp.onChangeShape({ currentTarget: { value: result.role } })
        }

        this.dwvApp.onChangeTool({ currentTarget: { value: tool.id } })
        this.selectedTool = tool.id;
        */
    }

    getImageUrl(wadoURI: string): string {
        return wadoURI.replace('dicomweb://', '//'); // + '&contentType=image/jpeg';
    }

    ngOnInit() {
        this.subscriptions = new Subscription();
        this.id = this.dwvService.register(this);

        this.dwvApp = new dwv.App();
        this.dwvApp.init({
            containerDivId: `dwv/${this.id}`,
            tools: this.toolButtons.map(b => b.id),
            //shapes: this.shapes.map(s => s.role),
            isMobile: false,
            useWebWorkers: true,
        });

        this.dwvApp.addEventListener('load-end', event => {
            this.loadProgress = 101;
        })

        const routeSubscription = this.activatedRoute.paramMap
            .pipe(
                mergeMap(params => {
                    return this.dxrService.loadStudy(params.get('studyID'))
                        .pipe(
                            map(study => [params.get('seriesID'), params.get('instanceID'), study])
                        )
                }),
                take(1)
            )
            .subscribe({
                next: ([seriesID, instanceID, response]) => {
                    const study = response.studies[0];

                    this.study = study;
                    this.series = study.seriesList.find(s => s.seriesInstanceUid === seriesID);


                    const imageUrl = this.getImageUrl(this.series.instances.find(i => i.sopInstanceUid == instanceID).url);
                    this.dwvApp.loadURLs([imageUrl]);
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

    }
}

