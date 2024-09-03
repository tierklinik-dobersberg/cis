import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import {
  ControlValueAccessor,
  DefaultValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { CKEditorComponent, CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmInputDirective } from '@tierklinik-dobersberg/angular/input';
import { DisplayNamePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { Subject } from 'rxjs';
import { MyEditor } from 'src/app/ckeditor';

export type FormatType = 'plain' | 'html' | 'markdown';

@Component({
  selector: 'app-text-input',
  templateUrl: './text-input.html',
  styleUrls: ['./text-input.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true,
    },
  ],
  imports: [CKEditorModule, NgTemplateOutlet, HlmSelectModule, BrnSelectModule, HlmInputDirective],
})
export class TextInputComponent
  implements OnDestroy, OnInit, ControlValueAccessor, AfterViewInit
{
  public Editor = MyEditor;

  protected readonly profiles = injectUserProfiles();

  @ViewChild('input', { static: false, read: DefaultValueAccessor })
  defaultAccessor: ControlValueAccessor | null = null;

  @ViewChild(CKEditorComponent, { static: false })
  ckEditor: CKEditorComponent | null = null;

  private _destroy$ = new Subject<void>();

  /** The expected output format. Only valid if choices is not set. */
  @Input()
  set format(format: '' | FormatType) {
    if (format === '') {
      format = 'plain';
    }
    this._format = format;
  }
  get format() {
    return this._format;
  }
  private _format: FormatType;

  /** Available input choices. Causes text-input to render a select box. */
  @Input()
  choices: string[] | null = null;

  protected readonly config: any = computed(() => {
    const profiles = this.profiles();

    return {
      mention: {
        feeds: [
          {
            marker: '@',
            feed: (queryText: string) => {
              queryText = queryText.toLowerCase();
              
              return new Promise((resolve, reject) => {
                const users = profiles
                  .filter(profile => {
                    return (
                      profile.user.username.toLowerCase().includes(queryText) ||
                      profile.user.firstName
                        ?.toLowerCase()
                        .includes(queryText) ||
                      profile.user.displayName
                        ?.toLowerCase()
                        .includes(queryText)
                    );
                  })
                  .map(profile => ({
                    id: '@' + profile.user.username,
                    userId: profile.user.id,
                    name: new DisplayNamePipe().transform(profile),
                  }));

                resolve(users);
              });
            },
          },
        ],
      },
    };
  });

  /**
   * Whether or not the input should be multiline.
   * This is only supported for "plain" format.
   * "html" is always multi-line.
   */
  @Input()
  set multiline(v: any) {
    this._multiline = coerceBooleanProperty(v);
  }
  get multiline() {
    return this._multiline;
  }
  private _multiline = false;

  _value: string = '';

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v));
  }
  get disabled() {
    return this._disabled;
  }
  private _disabled: boolean = false;

  constructor(private cdr: ChangeDetectorRef) {}

  _onChange: (_: string) => void = () => {};
  registerOnChange(fn: (_: string) => void) {
    this._onChange = fn;
    this.defaultAccessor?.registerOnChange(this._onChange);
    this.ckEditor?.registerOnChange(this._onChange);
  }

  _onTouch: () => any = () => {};
  registerOnTouched(fn: () => {}) {
    this._onTouch = fn;
    this.defaultAccessor?.registerOnTouched(this._onTouch);
    this.ckEditor?.registerOnTouched(this._onTouch);
  }

  setDisabledState(disabled: boolean) {
    this._disabled = disabled;
    this.cdr.markForCheck();
    if (this.defaultAccessor?.setDisabledState) {
      this.defaultAccessor.setDisabledState(disabled);
    }
    if (this.ckEditor?.setDisabledState) {
      this.ckEditor.setDisabledState(disabled);
    }
  }

  writeValue(value: string) {
    this._value = value;
    this.defaultAccessor?.writeValue(value);
    this.ckEditor?.writeValue(value);
    this.cdr.markForCheck();
  }

  onReady() {
    debugger;
  }

  ngOnInit() {
    if (this.format !== 'markdown') {
      // Markdown plugin is enabled by default so we need to remove
      // it for plain/html
      this.config.removePlugins = ['Markdown'];
    }
  }

  ngAfterViewInit() {
    this.setDisabledState(this.disabled);
    this.registerOnChange(this._onChange);
    this.registerOnTouched(this._onTouch);
    this.writeValue(this._value);
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
