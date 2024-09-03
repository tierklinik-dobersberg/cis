import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/ui-dialog-brain';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { Subject } from 'rxjs';
import { ConfigAPI, ConfigTest, Schema, SchemaInstance } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';
import { TkdOptionSpecInputComponent } from '../../option-spec-input';


@Component({
  templateUrl: './setting-test.html',
  styleUrls: ['./setting-test.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    BrnSelectModule,
    HlmSelectModule,
    TkdOptionSpecInputComponent,
    FormsModule,
    HlmButtonDirective
  ]
})
export class SettingTestComponent implements OnInit {
  private destroy$ = new Subject<void>();
  private configapi = inject(ConfigAPI);
  private dialogRef = inject(BrnDialogRef)
  private cdr = inject(ChangeDetectorRef)

  selectedTest: ConfigTest | null = null;
  values: { [key: string]: any } = {};

  testState: 'running' | 'success' | string = '';

  private data = injectBrnDialogContext();

  get schema(): Schema|null {
    return this.data.schema;
  }

  get config(): SchemaInstance {
    return this.data.config
  }

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
    this.dialogRef.close();
  }
}
