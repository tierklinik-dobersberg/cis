import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DxrService, Study } from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { splitCombinedCustomerAnimalIDs } from 'src/app/utils';

interface InstancePreview {
  previewUrl: string;
  seriesUid: string;
  instanceUid: string;
}

interface StudyWithMeta extends Study {
  previews: InstancePreview[];

  vetinfCID: string;
  vetinfAID: string;
}

@Component({
  templateUrl: './xray.html',
  styleUrls: ['./xray.scss']
})
export class XRayComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  offset = 0;
  studies: StudyWithMeta[] = [];
  searchText: string = '';
  popOverCustomer: Customer | null = null;
  trackBy: TrackByFunction<Study> = (_, study) => study.studyInstanceUid;

  ds = new StudyDataSource(this.dxrapi);

  constructor(
    private router: Router,
    private dxrapi: DxrService,
    private customerapi: CustomerAPI,
    private nzMessage: NzMessageService,
  ) { }

  openViewer(study: Study, preview: InstancePreview) {
    this.router.navigate(['xray/viewer', study.studyInstanceUid, preview.seriesUid, preview.instanceUid])
  }

  /**
   * Load the customer for the hovered study and shows it in
   * the popover.
   * 
   * @param visible Wether or not the popover should be visible.
   * @param study The study that was hovered.
   */
  onPopoverChange(visible: boolean, study: StudyWithMeta) {
    if (!visible) {
      return;
    }

    if (study.vetinfCID === '') {
      this.popOverCustomer = null;
      return;
    }

    this.customerapi.byId('vetinf', study.vetinfCID)
      .subscribe(
        customer => this.popOverCustomer = customer,
        err => {
          console.error(err);
          this.popOverCustomer = null;
        }
      )
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}

class StudyDataSource extends DataSource<StudyWithMeta> {
  private pageSize = 20;
  private cachedData: StudyWithMeta[] = [];
  private fetchedPages = new Set<number>();
  private dataStream = new BehaviorSubject<StudyWithMeta[]>(this.cachedData);
  private complete$ = new Subject<void>();
  private disconnect$ = new Subject<void>();

  constructor(private dxrservice: DxrService) {
    super();
  }

  completed(): Observable<void> {
    return this.complete$.asObservable();
  }

  connect(collectionViewer: CollectionViewer): Observable<StudyWithMeta[]> {
    this.setup(collectionViewer);
    return this.dataStream;
  }

  search(text: string) {
    console.log("search", text);

    if (text === "") {
      if (this.fetchedPages.has(0)) {
        this.updateCurrentStudies(this.cachedData.slice(0, this.pageSize), 0);
      }
      this.fetchPage(0);
      return
    }

    this.dxrservice.search(text)
      .subscribe(result => {
        this.updateCurrentStudies(result, -1);
      })
  }

  disconnect(): void {
    this.disconnect$.next();
    this.disconnect$.complete();
  }

  private setup(collectionViewer: CollectionViewer): void {
    this.fetchPage(0);

    collectionViewer.viewChange
      .pipe(
        takeUntil(this.complete$),
        takeUntil(this.disconnect$)
      ).subscribe(range => {
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
        this.updateCurrentStudies(studies, page);
      });
  }

  private updateCurrentStudies(studies: Study[], page = 0) {
    console.log(studies);
    const result = studies.map(study => {
      var urls: InstancePreview[] = [];

      if (!!study.seriesList) {
        study.seriesList.forEach(series => {
          if (!series.instances) {
            return;
          }

          series.instances.forEach(instance => {
            const url = instance.url.replace('dicomweb://', '//') + '&contentType=image/jpeg';
            urls.push({
              instanceUid: instance.sopInstanceUid,
              previewUrl: url,
              seriesUid: series.seriesInstanceUid,
            })
          })
        });
      }

      let cid: string = '';
      let aid: string = '';

      try {
        [cid, aid] = splitCombinedCustomerAnimalIDs(study.patientId);
      } catch (err) {
        console.error(err, study)
      }

      return {
        ...study,
        previews: urls,
        vetinfCID: cid,
        vetinfAID: aid,
      }
    });

    if (page >= 0) {
      this.cachedData.splice(page * this.pageSize, this.pageSize, ...result);
      this.dataStream.next(this.cachedData);
    } else {
      this.dataStream.next(result);
    }
  }
}