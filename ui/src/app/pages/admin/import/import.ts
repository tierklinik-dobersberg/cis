import { Component, OnDestroy, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ImportAPI } from 'src/app/api';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage } from 'src/app/utils';

@Component({
  templateUrl: './import.html',
  styleUrls: ['./import.scss'],
})
export class ImportPageComponent implements OnInit {
  fileToUpload: File = null;
  importing = false;

  constructor(
    private header: HeaderTitleService,
    private importapi: ImportAPI,
    private nzMessageService: NzMessageService,
  ) { }

  handleFileInput(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    this.fileToUpload = files.item(0);
  }

  importNeumayrContacts(): void {
    this.importing = true;

    this.importapi.importNeumayrContacts(this.fileToUpload).subscribe(data => {
      this.nzMessageService.info(`${data.new} neue, ${data.updated} geänderte und ${data.unchanged} unveränderte Kontakte`);
    }, error => {
      this.nzMessageService.error(extractErrorMessage(error, 'Import fehlgeschlagen'));
      this.importing = false;
    }, () => this.importing = false);
  }

  ngOnInit(): void {
    this.header.set('Daten Import');
  }
}
