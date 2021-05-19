import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Camera {
  name: string;
  description: string;
  location: string;
  type: string;
}

export interface LocalCamera extends Camera {
  id: string;
  streamUrl: string;
}

export interface CameraListResponse {
  [camID: string]: Camera;
}

@Injectable({ providedIn: 'root' })
export class CctvAPI {
  constructor(private http: HttpClient) { }

  listCameras(): Observable<LocalCamera[]> {
    return this.http.get<CameraListResponse>('/api/cctv/v1/cameras')
      .pipe(
        map(res => Object.keys(res).map(id => ({
          ...res[id],
          streamUrl: this.getCameraStreamURL(id),
          id: id,
        })))
      )
  }

  getCameraStreamURL(camID: string): string {
    return `/api/cctv/v1/camera/${camID}/stream`;
  }
}
