import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectOrthancClient } from "@tierklinik-dobersberg/angular/connect";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Month } from "@tierklinik-dobersberg/apis/common/v1";
import { ListStudiesResponse, Study } from "@tierklinik-dobersberg/apis/orthanc_bridge/v1";
import { addDays } from "date-fns";
import { toast } from 'ngx-sonner';
import { interval, startWith } from "rxjs";
import { environment } from "src/environments/environment";

class StudyModel extends Study {
    public readonly previewUrls: string[];

    constructor(study: PartialMessage<Study>, previewUrls?: string[]) {
        super(study)

        this.previewUrls = previewUrls || [];

        if (!previewUrls) {
            this.series
                ?.forEach(series => series.instances
                        ?.forEach(instance => {
                            if (instance.thumbnail) {
                                const blob = new Blob([instance.thumbnail.data], {
                                    type: instance.thumbnail.mime,
                                })

                                const url = URL.createObjectURL(blob)
                                this.previewUrls.push(url)
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
    imports: [
        HlmCardModule,
        HlmTableModule,
    ]
})
export class StudyCardComponent {
    private readonly client = injectOrthancClient();
    protected readonly studies = signal<StudyModel[]>([])

    protected openStudy(study: StudyModel) {
        window.open(
            `${environment.orthancBridge}/viewer?StudyInstanceUIDs=${study.studyUid}`,
            '_blank'
        )
    }

    constructor() {
        interval(10 * 1000)
            .pipe(
                startWith(0),
                takeUntilDestroyed()
            )
            .subscribe(() => {
                const now = new Date();
                const from = addDays(now, -7)

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

                        // revoke object URLs for preview images that are not part of the
                        // new response to avoid memory leaks
                        studies.forEach(study => {
                            study.previewUrls?.forEach(url => URL.revokeObjectURL(url))
                        })
                    })
            })
    }
}