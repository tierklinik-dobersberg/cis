import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnTabsModule } from "@spartan-ng/ui-tabs-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from '@tierklinik-dobersberg/angular/table';
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { Instance, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { interval, Subscription } from "rxjs";
import { DicomImageUrlPipe } from "src/app/pipes/dicom-instance-preview.pipe";

export interface DicomStudyDialogContext {
    study: Study;
}

@Component({
    standalone: true,
    imports:[
        HlmDialogHeaderComponent,
        HlmDialogDescriptionDirective,
        HlmDialogTitleDirective,
        HlmDialogFooterComponent,
        HlmButtonDirective,
        HlmBadgeDirective,
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
    ],
    providers: [
        ...provideIcons({})
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

    protected selectedInstance = signal<Instance | null>(null)
    protected selectedFrame = signal(1);

    protected frameCount = computed(() => {
        const instance = this.selectedInstance();
        if (!instance) {
            return 1
        }        

        const frameCount = instance.tags.find(tag => tag.name === 'NumberOfFrames')?.value[0].toJson() as number;

        return frameCount || 1;
    })

    protected fps = signal<number>(24);

    protected study = this._dialogContext.study;

    static open(service: HlmDialogService, ctx: DicomStudyDialogContext): BrnDialogRef<AppDicomStudyDialog> {
        return service.open(AppDicomStudyDialog, {
            context: ctx,
            contentClass: 'w-screen !w-[100dvw] overflow-hidden h-[100dvh] max-w-screen !max-h-[100dvh] max-h-screen'
        })
    }

    constructor() {
        const destroyRef = inject(DestroyRef);

        let sub = Subscription.EMPTY;
        effect(() => {
            const instance = this.selectedInstance();
            this.selectedFrame.set(1);
        }, { allowSignalWrites: true })

        effect(() => {
            const frameCount = this.frameCount();
            const fps = this.fps();

            sub.unsubscribe();

            if (frameCount === 1) {
                return
            }

            sub = interval(fps / 60 * 1000)
                .pipe(takeUntilDestroyed(destroyRef))
                .subscribe(() => {
                    let next = ((this.selectedFrame() + 1) % frameCount) + 1;
                    this.selectedFrame.set(next);
                })
        })
    }
    ngOnInit() {
        if (this.study.series?.length && this.study.series[0].instances?.length) {
            this.selectedInstance.set(this.study.series[0].instances[0])
        }
    }

    protected close() {
        this._dialogRef.close();
    }
}
