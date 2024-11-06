import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { PartialMessage } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { injectCurrentProfile } from '@tierklinik-dobersberg/angular/behaviors';
import { injectOrthancClient } from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { Month } from '@tierklinik-dobersberg/apis/common/v1';
import {
  ListStudiesRequest,
  ListStudiesResponse,
  Study,
} from '@tierklinik-dobersberg/apis/orthanc_bridge/v1';
import { toast } from 'ngx-sonner';
import { filter, interval, merge, startWith, tap } from 'rxjs';
import { AppDicomStudyDialog } from 'src/app/dialogs/dicom-study-dialog';
import { StudyService } from 'src/app/pages/welcome/study-card/study.service';
import { environment } from 'src/environments/environment';

interface PreviewURL {
  url: string;
  uid: string;
}

class StudyModel extends Study {
  public readonly previewUrls: PreviewURL[];

  constructor(study: PartialMessage<Study>, previewUrls?: PreviewURL[]) {
    super(study);

    this.previewUrls = previewUrls || [];
    this.ownerName = this.ownerName.replaceAll(', ERROR', '');

    if (!previewUrls) {
      this.series?.forEach(series =>
        series.instances?.forEach(instance => {
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

          if (url?.value?.length) {
            const first = url.value[0].toJson();
            this.previewUrls.push({
              url: first + '/rendered',
              uid: instance.instanceUid,
            });
          }
        })
      );
    }
  }
}

@Component({
  selector: 'app-dicom-list',
  standalone: true,
  templateUrl: './dicom-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmTableModule, ToDatePipe, DatePipe],
})
export class DicomListComponent {
  public readonly dateRange = input<[Date, Date] | null>(null);
  public readonly patientName = input<string | null>(null);
  public readonly ownerName = input<string | null>(null);
  public readonly pagination = input<{ page: number; size: number } | null>(
    null
  );

  private readonly client = injectOrthancClient();
  private readonly studyService = inject(StudyService);
  protected readonly studies = signal<StudyModel[]>([]);
  protected readonly layout = inject(LayoutService);
  protected readonly dialogService = inject(HlmDialogService);

  protected openInViewer(study: StudyModel, instance?: string) {
    let url = `${environment.orthancBridge}/viewer?StudyInstanceUIDs=${study.studyUid}`;
    if (instance) {
      url += '&initialSopInstanceUid=' + instance;
    }
    window.open(url, '_blank');
  }

  protected openStudyDialog(study: StudyModel, instance?: string) {
    AppDicomStudyDialog.open(this.dialogService, {
      study,
    });
  }

  constructor() {
    let inProgress = false;
    const currentUser = injectCurrentProfile();

    merge(
      interval(5 * 60 * 1000),
      this.studyService.instanceReceived,
      toObservable(currentUser),
      toObservable(this.dateRange),
      toObservable(this.patientName),
      toObservable(this.ownerName)
    )
      .pipe(
        tap(() => console.log("study reload triggered")),
        startWith(0),
        takeUntilDestroyed(),
        filter(() => !inProgress || !currentUser())
      )
      .subscribe((event) => {
        const req: PartialMessage<ListStudiesRequest> = {
          enableFuzzyMatching: true,
        };

        const range = this.dateRange();
        if (range) {
          const [from, to] = range;

          req.dateRange = {
            from: {
              day: from.getDate(),
              month: (from.getMonth() + 1) as Month,
              year: BigInt(from.getFullYear()),
            },
            to: {
              day: to.getDate(),
              month: (to.getMonth() + 1) as Month,
              year: BigInt(to.getFullYear()),
            },
          };
        }

        const patientName = this.patientName();
        if (patientName) {
          req.patientName = `*${patientName}*`;
        }

        const ownerName = this.ownerName;
        if (ownerName) {
          req.ownerName = `*${ownerName}*`;
        }

        const pagination = this.pagination();
        if (pagination) {
          req.pagination = {
            kind: {
              case: 'page',
              value: pagination.page,
            },
            pageSize: pagination.size,
          };
        }

        console.log("loading dicom studies", req, "trigger", event)

        inProgress = true;
        this.client
          .listStudies(req)
          .catch(err => {
            const cerr = ConnectError.from(err);
            toast.error('DICOM Studies failed to load', {
              description: cerr.message,
            });

            return new ListStudiesResponse();
          })
          .then(response => {
            const studies = this.studies() || [];
            this.studies.set(
              (response.studies || []).map(study => {
                const existing = studies.findIndex(
                  s => s.studyUid === study.studyUid
                );
                if (existing >= 0) {
                  studies.splice(existing, 1);
                  return new StudyModel(study, studies[existing].previewUrls);
                }

                return new StudyModel(study);
              })
            );
          })
          .finally(() => (inProgress = false));
      });
  }
}
