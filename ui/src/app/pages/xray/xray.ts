import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DxrService, Study } from 'src/app/api';

interface InstancePreview {
  previewUrl: string;
  seriesUid: string;
  instanceUid: string;
}

interface StudyWithPreview extends Study {
  previews: InstancePreview[];
}

@Component({
  templateUrl: './xray.html',
  styleUrls: ['./xray.scss']
})
export class XRayComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  offset = 0;
  studies: StudyWithPreview[] = [];
  trackBy: TrackByFunction<Study> = (_, study) => study.studyInstanceUId;

  ds = new StudyDataSource(this.dxrapi);

  constructor(private dxrapi: DxrService,
    private nzMessage: NzMessageService) { }

  openViewer(study: Study, preview: InstancePreview) {

  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}

class StudyDataSource extends DataSource<StudyWithPreview> {
  private pageSize = 20;
  private cachedData: StudyWithPreview[] = [];
  private fetchedPages = new Set<number>();
  private dataStream = new BehaviorSubject<StudyWithPreview[]>(this.cachedData);
  private complete$ = new Subject<void>();
  private disconnect$ = new Subject<void>();

  constructor(private dxrservice: DxrService) {
    super();
  }

  completed(): Observable<void> {
    return this.complete$.asObservable();
  }

  connect(collectionViewer: CollectionViewer): Observable<StudyWithPreview[]> {
    this.setup(collectionViewer);
    return this.dataStream;
  }

  disconnect(): void {
    this.disconnect$.next();
    this.disconnect$.complete();
  }

  private setup(collectionViewer: CollectionViewer): void {
    this.fetchPage(0);

    collectionViewer.viewChange.pipe(takeUntil(this.complete$), takeUntil(this.disconnect$)).subscribe(range => {
      if (this.cachedData.length >= 50) {
        this.complete$.next();
        this.complete$.complete();
      } else {
        const endPage = this.getPageForIndex(range.end);
        this.fetchPage(endPage + 1);
      }
    });
  }

  private getPageForIndex(index: number): number {
    return Math.floor(index / this.pageSize);
  }

  private fetchPage(page: number): void {
    if (this.fetchedPages.has(page)) {
      return;
    }
    this.fetchedPages.add(page);

    this.dxrservice
      .loadLastStudies(page * this.pageSize, this.pageSize)
      .subscribe(studies => {
        const result = studies.map(study => {
          var urls: InstancePreview[] = [];

          study.seriesList.forEach(series => {
            series.instances.forEach(instance => {
              const url = instance.url.replace('dicomweb://', '//').replace('/wado', '/api/dxray/v1/wado') + '&contentType=image/jpeg';
              urls.push({
                instanceUid: instance.sopInstanceUid,
                previewUrl: url,
                seriesUid: series.seriesInstanceUid,
              })
            })
          });


          return {
            ...study,
            previews: urls,
          }
        });

        this.cachedData.splice(page * this.pageSize, this.pageSize, ...result);
        this.dataStream.next(this.cachedData);
      });
  }
}