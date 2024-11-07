import { ChangeDetectionStrategy, Component, computed, inject, model, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ConnectError } from "@connectrpc/connect";
import { lucideDownload, lucideExternalLink, lucideMail, lucideMoreVertical, lucideShare } from "@ng-icons/lucide";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCheckboxModule } from "@tierklinik-dobersberg/angular/checkbox";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { Instance, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { toast } from "ngx-sonner";
import { StudyService } from "src/app/components/dicom/study.service";
import { DicomImageUrlPipe } from "src/app/pipes/dicom-instance-preview.pipe";
import { SortDicomTagsPipe } from "src/app/pipes/sort-dicom-tags.pipe";
import { DIALOG_CONTENT_CLASS } from "../constants";

export interface DicomExportStudyDialogContext {
    study: Study;
}

export class InstanceModel extends Instance {
    public readonly selected = signal(false);
}

@Component({
    standalone: true,
    imports:[
        HlmDialogHeaderComponent,
        HlmDialogDescriptionDirective,
        HlmDialogTitleDirective,
        HlmDialogFooterComponent,
        HlmButtonDirective,
        HlmIconModule,
        DicomImageUrlPipe,
        HlmCheckboxModule,
        HlmLabelDirective,
        SortDicomTagsPipe,
        FormsModule
    ],
    providers: [
        ...provideIcons({
            lucideExternalLink,
            lucideMoreVertical,
            lucideShare,
            lucideDownload,
            lucideMail,
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
export class AppDicomExportStudyDialog implements OnInit {
    private readonly _dialogRef = inject<BrnDialogRef<unknown>>(BrnDialogRef);
    private readonly _dialogContext = injectBrnDialogContext<DicomExportStudyDialogContext>();

    protected readonly studyService = inject(StudyService)
    protected readonly selectedInstance = signal<Instance | null>(null)

    protected study = this._dialogContext.study;

    protected instances = signal<InstanceModel[]>([]);
    protected exportDicom = model(true);
    protected exportPNG = model(true)
    protected exportJPEG = model(false);

    protected readonly invalid = computed(() => {
        const instances = this.instances()
        const dicom = this.exportDicom();
        const png = this.exportPNG();
        const jpeg = this.exportJPEG();

        return !(instances.length > 0 && (dicom || png || jpeg))
    })

    ngOnInit(): void {
        const instances = [];
        this.study
            .series?.forEach(series => series.instances?.forEach(instance => 
                instances.push(new InstanceModel(instance))
            ));
    }

    static open(service: HlmDialogService, ctx: DicomExportStudyDialogContext): BrnDialogRef<AppDicomExportStudyDialog> {
        return service.open(AppDicomExportStudyDialog, {
            context: ctx,
            contentClass: DIALOG_CONTENT_CLASS
        })
    }

    protected export() {
        const kinds: ('png' | 'dicom' | 'jpeg')[] = [];

        if (this.exportDicom()) {
            kinds.push('dicom')
        }

        if (this.exportJPEG()) {
            kinds.push('jpeg')
        }

        if (this.exportPNG()) {
            kinds.push('png')
        }

        this.studyService
            .downloadStudy(this.study.studyUid, this.instances().map(i => i.instanceUid), kinds)
            .then(() => {
                this.close();
            })
            .catch(err => {
                const cerr = ConnectError.from(err);

                toast.error('Studie konnte nicht exportiert werden', {
                    description: cerr.message
                })
            })
    }

    protected close() {
        this._dialogRef.close();
    }
}
