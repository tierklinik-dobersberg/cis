import { inject, Injectable } from '@angular/core';
import { injectOrthancClient } from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import {
  InstanceReceivedEvent,
  Study,
} from '@tierklinik-dobersberg/apis/orthanc_bridge/v1';
import { Subject } from 'rxjs';
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

  public downloadStudy(studyUid: string, instanceUids: string[] | null = null, renderType: 'png' | 'jpeg' | 'dicom' = 'png') {
    return this.orthancBridgeClient
      .downloadStudy({
        studyUid,
        instanceUids,
      })
      .then(response => {
        console.log("download link: ", response.downloadLink)

        window.open(response.downloadLink, "_blank", "popup,noopener")

        return response
      })
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
