import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, model, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { provideIcons } from "@ng-icons/core";
import { lucidePause, lucidePlay } from "@ng-icons/lucide";
import { HlmButtonModule } from "@tierklinik-dobersberg/angular/button";
import { HlmIconModule } from "@tierklinik-dobersberg/angular/icon";
import { Instance, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { filter, interval, Subscription } from "rxjs";
import { DicomImageUrlPipe } from "src/app/pipes/dicom-instance-preview.pipe";

@Component({
    selector: 'dicom-viewer',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './dicom-viewer.html',
    host: {
        'class': 'block w-full h-full bg-black relative'
    },
    imports: [
        DicomImageUrlPipe,
        HlmButtonModule,
        HlmIconModule,
    ],
    providers: [
        provideIcons({
            lucidePlay,
            lucidePause
        })
    ]
})
export class DicomViewer {
    public readonly study = input.required<Study>();
    public readonly instance = input.required<Instance | null>();

    public readonly loading = model(true);
    public readonly playing = signal(true);

    protected frameCount = computed(() => {
        const instance = this.instance();
        if (!instance) {
            return 1
        }        

        const frameCount = instance.tags.find(tag => tag.name === 'NumberOfFrames')?.value[0].toJson() as number;

        return frameCount || 1;
    })

    protected fps = signal<number>(24);

    protected readonly selectedFrame = signal(1);

    constructor() {
        const destroyRef = inject(DestroyRef);

        let sub = Subscription.EMPTY;
        effect(() => {
            this.instance();

            this.loading.set(true);
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
                .pipe(
                    takeUntilDestroyed(destroyRef),
                    filter(() => this.playing())
                )
                .subscribe(() => {
                    let next = ((this.selectedFrame() + 1) % frameCount) + 1;
                    this.selectedFrame.set(next);
                })
        })
    }
}