import { Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { Subject } from 'rxjs';
import { retryWhen, takeUntil, delay } from 'rxjs/operators';
import { CctvAPI, LocalCamera } from 'src/app/api';

@Component({
  selector: 'app-camera-list',
  templateUrl: './camera-list.html',
  styleUrls: ['./camera-list.scss'],
})
export class CameraListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  cameras: LocalCamera[] = [];

  trackByCam: TrackByFunction<LocalCamera> = (_: number, cam: LocalCamera) => cam.id;

  constructor(
    private cctvapi: CctvAPI,
  ) { }

  ngOnInit() {
    this.cctvapi.listCameras()
      .pipe(
        takeUntil(this.destroy$),
        retryWhen(d => d.pipe(delay(1000)))
      )
      .subscribe(cams => this.cameras = cams)
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
