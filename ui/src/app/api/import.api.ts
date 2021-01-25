import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface ImportStats {
    new: number;
    updated: number;
    unchanged: number;
}

@Injectable({
    providedIn: 'root'
})
export class ImportAPI {
    constructor(private http: HttpClient) { }

    importNeumayrContacts(fileToUpload: File): Observable<ImportStats> {
        const endpoint = `/api/import/v1/neumayr/contacts`
        const formData: FormData = new FormData();

        formData.append('file', fileToUpload, fileToUpload.name);

        return this.http.post<ImportStats>(endpoint, formData);
    }
}