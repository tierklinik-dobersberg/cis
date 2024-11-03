import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { BrnHoverCardModule } from "@spartan-ng/ui-hovercard-brain";
import { HlmCardDirective, HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectOrthancClient } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmHoverCardModule } from "@tierklinik-dobersberg/angular/hovercard";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Month } from "@tierklinik-dobersberg/apis/common/v1";
import { ListStudiesResponse, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { addDays } from "date-fns";
import { toast } from 'ngx-sonner';
import { filter, interval, merge, startWith } from "rxjs";
import { AppDicomStudyDialog } from "src/app/dialogs/dicom-study-dialog";
import { environment } from "src/environments/environment";
import { StudyService } from "./study.service";

interface PreviewURL {
    url: string;
    uid: string;
}

class StudyModel extends Study {
    public readonly previewUrls: PreviewURL[];

    constructor(study: PartialMessage<Study>, previewUrls?: PreviewURL[]) {
        super(study)

        this.previewUrls = previewUrls || [];
        this.ownerName = this.ownerName.replaceAll(', ERROR', '')

        if (!previewUrls) {
            this.series
                ?.forEach(series => series.instances
                        ?.forEach(instance => {
                            /*
                            if (instance.thumbnail) {
                                const blob = new Blob([instance.thumbnail.data], {
                                    type: instance.thumbnail.mime,
                                })

                                const url = URL.createObjectURL(blob)
                                this.previewUrls.push(url)
                            }
                            */

                            let url = instance.tags.find(t => t.name === 'RetrieveURL');
                            if (!url?.value?.length) {
                                url = instance.tags.find(t => t.name === 'RetrieveURI');
                            }

                            if(url?.value?.length) {
                                const first = url.value[0].toJson();
                                this.previewUrls.push({
                                    url: first+'/rendered',
                                    uid: instance.instanceUid,
                                })
                            }
                        })
                )
        }
    }
}

@Component({
    selector: 'app-study-card',
    standalone: true,
    templateUrl: './study-card.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: '@container',
    },
    hostDirectives: [HlmCardDirective],
    imports: [
        HlmCardModule,
        HlmTableModule,
        ToDatePipe,
        DatePipe,
        BrnHoverCardModule,
        HlmHoverCardModule
    ]
})
export class StudyCardComponent {
    private readonly client = injectOrthancClient();
    private readonly studyService = inject(StudyService);
    protected readonly studies = signal<StudyModel[]>([])
    protected readonly layout = inject(LayoutService);
    protected readonly dialogService = inject(HlmDialogService);

    protected openInViewer(study: StudyModel, instance?: string) {
        let url = `${environment.orthancBridge}/viewer?StudyInstanceUIDs=${study.studyUid}`
        if (instance) {
            url += '&initialSopInstanceUid=' + instance
        }
        window.open(
            url,
            '_blank'
        )
    }

    protected openStudyDialog(study: StudyModel, instance?: string) {
        AppDicomStudyDialog.open(this.dialogService, {
            study,
        })
    }

    constructor() {
        let inProgress = false;

        merge(interval(5* 60 * 1000), this.studyService.instanceReceived)
            .pipe(
                startWith(0),
                takeUntilDestroyed(),
                filter(() => !inProgress)
            )
            .subscribe(() => {
                const now = new Date();
                const from = addDays(now, -7)

                inProgress = true;
                this.client
                    .listStudies({
                        dateRange: {
                            from: {
                                day: from.getDate(),
                                month: from.getMonth()+1 as Month,
                                year: BigInt(from.getFullYear()),
                            },
                            to: {
                                day: now.getDate(),
                                month: now.getMonth()+1 as Month,
                                year: BigInt(now.getFullYear()),
                            }
                        },
                        pagination: {
                            pageSize: 10,
                            kind: {
                                case: 'page',
                                value: 0,
                            },
                        },
                    })
                    .catch(err => {
                        const cerr = ConnectError.from(err)
                        toast.error('DICOM Studies failed to load', {
                            description: cerr.message,
                        })

                        return new ListStudiesResponse()
                    })
                    .then(response => {
                        const studies = this.studies() || [];
                        this.studies.set(
                            (response.studies || [])
                                .map(study => {
                                    const existing = studies.findIndex(s => s.studyUid === study.studyUid)
                                    if (existing >= 0) {
                                        studies.splice(existing, 1)
                                        return new StudyModel(study, studies[existing].previewUrls)
                                    }

                                    return new StudyModel(study)
                                })
                        );
                    })
                    .finally(() => inProgress = false)
            })
    }
}