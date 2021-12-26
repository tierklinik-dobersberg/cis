import { CollectionViewer, DataSource } from '@angular/cdk/collections';
import { Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DxrService, Instance, Series, Study } from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { splitCombinedCustomerAnimalIDs, toggleRouteQueryParam } from 'src/app/utils';

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
  constructor(
    private header: HeaderTitleService,
    private router: Router,
    private dxrapi: DxrService,
    private customerapi: CustomerAPI,
    private activeRoute: ActivatedRoute,
    public layout: LayoutService,
  ) { }

  private subscriptions = Subscription.EMPTY;

  offset = 0;
  studies: StudyWithMeta[] = [];
  searchText = '';
  popOverCustomer: Customer | null = null;
  drawerVisible = false;
  drawerStudy: StudyWithMeta | null = null;

  ds = new StudyDataSource(this.dxrapi);
  trackBy: TrackByFunction<Study> = (_, study) => study.studyInstanceUid;

  openViewer(study: Study, previewOrSeries: InstancePreview | Series, instance?: Instance): void {
    let seriesUid: string;
    let instanceUid: string;

    if (!!instance) {
      seriesUid = (previewOrSeries as Series).seriesInstanceUid;
      instanceUid = instance.sopInstanceUid;
    } else {
      seriesUid = (previewOrSeries as InstancePreview).seriesUid;
      instanceUid = (previewOrSeries as InstancePreview).instanceUid;
    }
    this.router.navigate(['xray/viewer', study.studyInstanceUid, seriesUid, instanceUid]);
  }

  /**
   * Load the customer for the hovered study and shows it in
   * the popover.
   *
   * @param visible Wether or not the popover should be visible.
   * @param study The study that was hovered.
   */
  onPopoverChange(visible: boolean, study: StudyWithMeta): void {
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
      );
  }

  toggleDrawer(uid?: string) {
    toggleRouteQueryParam(this.router, this.activeRoute.snapshot, 'study', uid || '');
  }

  ngOnInit(): void {
    this.header.set('Röntgen Aufnahmen', 'Durchsuchen und Betrachten von Röntgen-Studien');
    this.subscriptions = new Subscription();

    const routeSub = this.activeRoute.queryParamMap
      .subscribe(params => {
        const studyUID = params.get('study')
        if (!!studyUID) {
          this.drawerStudy = this.studies.find(study => study.studyInstanceUid === studyUID);
          this.drawerVisible = !!this.drawerStudy;
        } else {
          this.drawerStudy = null;
          this.drawerVisible = false;
        }
      });
    this.subscriptions.add(routeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

class StudyDataSource extends DataSource<StudyWithMeta> {
  private pageSize = 20;
  private cachedData: StudyWithMeta[] = [];
  private fetchedPages = new Set<number>();
  private dataStream = new BehaviorSubject<StudyWithMeta[]>(this.cachedData);
  private disconnect$ = new Subject<void>();

  constructor(private dxrservice: DxrService) {
    super();
  }

  connect(collectionViewer: CollectionViewer): Observable<StudyWithMeta[]> {
    this.setup(collectionViewer);
    return this.dataStream;
  }

  search(text: string): void {
    if (text === '') {
      if (this.fetchedPages.has(0)) {
        this.updateCurrentStudies(this.cachedData.slice(0, this.pageSize), 0);
      }
      this.fetchPage(0);
      return;
    }

    this.dxrservice.search(text)
      .subscribe(result => {
        this.updateCurrentStudies(result, -1);
      });
  }

  disconnect(): void {
    this.disconnect$.next();
    this.disconnect$.complete();
  }

  private setup(collectionViewer: CollectionViewer): void {
    this.fetchPage(0);

    collectionViewer.viewChange
      .pipe(
        takeUntil(this.disconnect$)
      ).subscribe(range => {
        const endPage = this.getPageForIndex(range.end);
        this.fetchPage(endPage + 1);
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

  private updateCurrentStudies(studies: Study[], page = 0): void {
    const result = studies.map(study => {
      const urls: InstancePreview[] = [];

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
            });
          });
        });
      }

      let cid = '';
      let aid = '';

      try {
        [cid, aid] = splitCombinedCustomerAnimalIDs(study.patientId);
      } catch (err) {
        console.error(err, study);
      }

      return {
        ...study,
        previews: urls,
        vetinfCID: cid,
        vetinfAID: aid,
      };
    });

    if (page >= 0) {
      this.cachedData.splice(page * this.pageSize, this.pageSize, ...result);
      this.dataStream.next(this.cachedData);
    } else {
      this.dataStream.next(result);
    }
  }
}
