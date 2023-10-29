import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  InjectionToken,
  OnInit,
  Optional,
  inject,
} from '@angular/core';
import { NZ_MODAL_DATA, NzModalRef } from 'ng-zorro-antd/modal';
import { Subject } from 'rxjs';
import { ConfigAPI, ConfigTest, Schema, SchemaInstance } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';


@Component({
  templateUrl: './setting-test.html',
  styleUrls: ['./setting-test.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingTestComponent implements OnInit {
  private destroy$ = new Subject<void>();

  selectedTest: ConfigTest | null = null;
  values: { [key: string]: any } = {};

  testState: 'running' | 'success' | string = '';

  private data = inject(NZ_MODAL_DATA);

  get schema(): Schema|null {
    return this.data.schema;
  }

  get config(): SchemaInstance {
    return this.data.config
  }

  constructor(
    private configapi: ConfigAPI,
    private modalRef: NzModalRef,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.selectedTest = this.schema.tests[0] || null;
  }

  executeTest() {
    this.testState = 'running';

    this.configapi
      .testSetting(
        this.schema.name,
        this.selectedTest.id,
        this.config,
        this.values
      )
      .subscribe({
        next: (res) => {
          console.log(res);
          if (!!res?.error) {
            this.testState = res.error;
          } else {
            this.testState = 'success';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.testState = extractErrorMessage(err);
          this.cdr.markForCheck();
        },
      });
  }

  cancel() {
    this.modalRef.close();
  }
}
