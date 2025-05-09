import { DatePipe, JsonPipe, LocationStrategy } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, model, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { lucideDownload, lucideExternalLink, lucideEye, lucideMail, lucideMoreVertical, lucideShare } from "@ng-icons/lucide";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnMenuModule } from "@spartan-ng/ui-menu-brain";
import { BrnTabsModule } from "@spartan-ng/ui-tabs-brain";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmDialogDescriptionDirective, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmMenuModule } from "@tierklinik-dobersberg/angular/menu";
import { ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from '@tierklinik-dobersberg/angular/table';
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { Instance, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { DicomViewer } from "src/app/components/dicom/dicom-viewer";
import { StudyService } from "src/app/components/dicom/study.service";
import { SwiperContentDirective } from "src/app/components/swiper/swiper-content.directive";
import { ListSwiperComponent } from "src/app/components/swiper/swiper.component";
import { DicomImageUrlPipe } from "src/app/pipes/dicom-instance-preview.pipe";
import { SortDicomTagsPipe } from "src/app/pipes/sort-dicom-tags.pipe";

export interface DicomStudyDialogContext {
    study: Study;
}

@Component({
    standalone: true,
    imports:[
        HlmDialogHeaderComponent,
        HlmDialogDescriptionDirective,
        HlmDialogTitleDirective,
        HlmButtonDirective,
        JsonPipe,
        HlmTableComponent,
        HlmThComponent,
        HlmTrowComponent,
        HlmTdComponent,
        HlmTabsModule,
        BrnTabsModule,
        ToDatePipe,
        DatePipe,
        HlmIconModule,
        DicomImageUrlPipe,
        SortDicomTagsPipe,
        DicomViewer,
        HlmMenuModule,
        BrnMenuModule,
        ListSwiperComponent,
        SwiperContentDirective,
    ],
    providers: [
        ...provideIcons({
            lucideExternalLink,
            lucideMoreVertical,
            lucideShare,
            lucideDownload,
            lucideMail,
            lucideEye
        })
    ],
    templateUrl: './dicom-study-dialog.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [
        `
        :host {
            @apply flex flex-col h-full w-full overflow-hidden;
        }
        `
    ]
})
export class AppDicomStudyDialog implements OnInit {
    private readonly _dialogRef = inject<BrnDialogRef<unknown>>(BrnDialogRef);
    private readonly _dialogContext = injectBrnDialogContext<DicomStudyDialogContext>();

    protected readonly studyService = inject(StudyService)
    protected readonly selectedInstance = computed(() => {
        const index = this.selectedIndex();

        return this.allInstances[index];
    })
    protected readonly selectedIndex = model<number>(0);

    constructor() {
        const location = inject(LocationStrategy)

        location.pushState("DicomStudyDialog", "DicomStudyDialog", inject(Router).url, '')
        location.onPopState(() => {
            this._dialogRef.close();
        })
    }

    protected study = this._dialogContext.study;

    static open(service: HlmDialogService, ctx: DicomStudyDialogContext): BrnDialogRef<AppDicomStudyDialog> {
        return service.open(AppDicomStudyDialog, {
            context: ctx,
            contentClass: 'w-screen !w-[100dvw] overflow-hidden h-[100dvh] max-w-screen !max-h-[100dvh] max-h-screen'
        })
    }

    protected allInstances: Instance[] = [];

    ngOnInit() {
        this.study.series?.forEach(s => s.instances?.forEach(i => this.allInstances.push(i)))
    }

    protected close() {
        this._dialogRef.close();
    }
}
