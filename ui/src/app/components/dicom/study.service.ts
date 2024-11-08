
import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Duration as DurationPb, PartialMessage } from '@bufbuild/protobuf';
import { injectOrthancClient } from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import { Duration } from '@tierklinik-dobersberg/angular/utils/date';
import {
  DownloadType,
  InstanceReceivedEvent,
  Study,
} from '@tierklinik-dobersberg/apis/orthanc_bridge/v1';
import { Subject } from 'rxjs';
import { AppDicomExportStudyDialog } from 'src/app/dialogs/dicom-export-study-dialog';
import { AppDicomStudyDialog } from 'src/app/dialogs/dicom-study-dialog';
import { EventService } from 'src/app/services/event.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StudyService {
  protected readonly eventsService = inject(EventService);
  protected readonly dialogService = inject(HlmDialogService)
  protected readonly orthancBridgeClient = injectOrthancClient();

  private readonly document = inject(DOCUMENT);
  private readonly instanceReceived$ = new Subject<InstanceReceivedEvent>();
  private readonly seenStudies = new Set<string>();

  public instanceReceived = this.instanceReceived$.asObservable();

  public openInViewer(study: Study, instance?: string) {
    let url = `${environment.orthancBridge}/viewer?StudyInstanceUIDs=${study.studyUid}`;
    if (instance) {
      url += '&initialSopInstanceUid=' + instance;
    }
    window.open(url, '_blank');
  }

  public openStudyDialog(study: Study, instance?: string) {
    AppDicomStudyDialog.open(this.dialogService, {
      study,
    });
  }

  public exportStudy(study: Study) {
    AppDicomExportStudyDialog.open(this.dialogService, {study})
  }

  public downloadStudy(studyUid: string, instanceUids: string[] | null = null, renderType: ('avi' | 'png' | 'jpeg' | 'dicom')[] = ['png'], autoDownload = true, ttl?: string) {
    const types: DownloadType[] = renderType.map(k => {
      if (k === 'png') {
        return DownloadType.PNG
      }

      if (k === 'jpeg') {
        return DownloadType.JPEG
      }

      if (k === 'dicom') {
        return DownloadType.DICOM
      }

      if (k === 'avi') {
        return DownloadType.AVI
      }

      return DownloadType.DOWNLOAD_TYPE_UNSPECIFIED
    })

    let ttlPb: PartialMessage<DurationPb> | undefined = undefined;

    if (ttl) {
      ttlPb = Duration.parseString(ttl).toProto()
    }

    return this.orthancBridgeClient
      .downloadStudy({
        studyUid,
        instanceUids,
        types,
        timeToLive: ttlPb,
      })
      .then(response => {
        if (autoDownload) {
          this.downloadLink(response.downloadLink)
        }

        return response
      })
  }

  private downloadLink(link: string) {
    const a = this.document.createElement('a')
    a.href = link

    this.document.body.appendChild(a)
    a.click()

    this.document.body.removeChild(a)
  }

  constructor() {
    this.eventsService
      .subscribe(new InstanceReceivedEvent())
      .subscribe(event => {
        if (!this.seenStudies.has(event.studyUid)) {
          this.instanceReceived$.next(event);
          this.seenStudies.add(event.studyUid);
        }
      });
  }
}
