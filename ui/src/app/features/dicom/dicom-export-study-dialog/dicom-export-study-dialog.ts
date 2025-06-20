import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, model, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ConnectError } from "@connectrpc/connect";
import { lucideSquare, lucideSquareCheck } from "@ng-icons/lucide";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCheckboxModule } from "@tierklinik-dobersberg/angular/checkbox";
import { HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { Instance, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { toast } from "ngx-sonner";
import { StudyService } from "src/app/features/dicom/study.service";
import { DicomImageUrlPipe } from "src/app/pipes/dicom-instance-preview.pipe";
import { AbstractBaseDialog } from "../../../dialogs/base-dialog/base-dialog.component";
import { DIALOG_CONTENT_CLASS } from "../../../dialogs/constants";

export interface DicomExportStudyDialogContext {
    study: Study;
    ttl?: string;
    mode: 'download' | 'link' | 'share';
}

export class InstanceModel extends Instance {
    public readonly selected = signal(true);
}

@Component({
    standalone: true,
    imports:[
        HlmDialogHeaderComponent,
        HlmDialogTitleDirective,
        HlmDialogFooterComponent,
        HlmButtonDirective,
        HlmIconModule,
        DicomImageUrlPipe,
        HlmCheckboxModule,
        HlmLabelDirective,
        FormsModule,
        NgClass
    ],
    providers: [
        ...provideIcons({
            lucideSquareCheck,
            lucideSquare
        })
    ],
    templateUrl: './dicom-export-study-dialog.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [
        `
        :host {
            @apply flex flex-col h-full w-full overflow-hidden;
        }
        `
    ]
})
export class AppDicomExportStudyDialog extends AbstractBaseDialog implements OnInit {
    private readonly _dialogRef = inject<BrnDialogRef<unknown>>(BrnDialogRef);
    private readonly _dialogContext = injectBrnDialogContext<DicomExportStudyDialogContext>();

    protected readonly studyService = inject(StudyService)
    protected readonly selectedInstance = signal<Instance | null>(null)

    protected study = this._dialogContext.study;
    protected mode = this._dialogContext.mode;

    protected instances = signal<InstanceModel[]>([]);
    protected exportDicom = model(true);
    protected exportPNG = model(true)
    protected exportJPEG = model(false);
    protected exportAVI = model(true);

    protected readonly invalid = computed(() => {
        const instances = this.instances()
        const dicom = this.exportDicom();
        const png = this.exportPNG();
        const jpeg = this.exportJPEG();
        const avi = this.exportAVI();
        const canAvi = this.showAvi();

        return !(instances.length > 0 && (dicom || png || jpeg || (avi && canAvi)))
    })

    protected exporting = signal(false);

    protected showAvi = computed(() => {
        const instances = this.instances();

        return instances.some(instance => {
            const tag = instance.tags.find(t => t.name === 'NumberOfFrames')
            if (!!tag) {
                return true
            }

            return false
        })
    })

    protected selectAll() {
        this.instances().forEach(i => i.selected.set(true))
    }

    protected deselectAll() {
        this.instances().forEach(i => i.selected.set(false))
    }

    ngOnInit(): void {
        const instances = [];
        this.study
            .series?.forEach(series => series.instances?.forEach(instance =>  {
                instances.push(new InstanceModel(instance))
            }));

        this.instances.set(instances);
    }

    static open(service: HlmDialogService, ctx: DicomExportStudyDialogContext): BrnDialogRef<AppDicomExportStudyDialog> {
        return service.open(AppDicomExportStudyDialog, {
            context: ctx,
            contentClass: DIALOG_CONTENT_CLASS
        })
    }

    protected export() {
        const instances = this.instances()
            .filter(i => i.selected())
            .map(i => i.instanceUid)

        if (this.mode === 'share') {
            this.studyService.shareStudy(this.study.studyUid, instances)
        }

        this.exporting.set(true);

        const kinds: ('png' | 'dicom' | 'jpeg' | 'avi')[] = [];

        if (this.exportDicom()) {
            kinds.push('dicom')
        }

        if (this.exportJPEG()) {
            kinds.push('jpeg')
        }

        if (this.exportPNG()) {
            kinds.push('png')
        }

        if (this.exportAVI() && this.showAvi())  {
            kinds.push('avi')
        }

        this.studyService
            .downloadStudy(this.study.studyUid, instances, kinds, this.mode === 'download', this._dialogContext.ttl)
            .then(() => {
                this.close();
            })
            .catch(err => {
                const cerr = ConnectError.from(err);

                toast.error('Studie konnte nicht exportiert werden', {
                    description: cerr.message
                })
            })
            .finally(() => this.exporting.set(false))
    }

    protected close() {
        this._dialogRef.close();
    }
}
