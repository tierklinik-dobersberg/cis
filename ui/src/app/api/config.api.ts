import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface ExternalLink {
  ParentMenu: string;
  Text: string;
  Icon: string;
  RequiresRole: string[];
  Link: string;
}

export interface UIConfig {
  HideUsersWithRole?: string[];
  ExternalLinks?: ExternalLink[];
}

@Injectable({
  providedIn: 'root'
})
export class ConfigAPI {
  constructor(private http: HttpClient) { }

  uiConfig(): Observable<UIConfig> {
    return this.http.get<UIConfig>('/api/config/v1/ui');
  }
}
