import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, forwardRef, inject, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ControlValueAccessor, DefaultValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import { CKEditorComponent } from "@ckeditor/ckeditor5-angular";
import { firstValueFrom, map, Subject } from "rxjs";
import { UserService } from 'src/app/api';
import { UserNamePipe } from "../pipes";

import ClassicEditor from "@tierklinik-dobersberg/ckeditor-build"


export type FormatType = 'plain' | 'html' | 'markdown';

@Component({
  selector: 'app-text-input',
  templateUrl: './text-input.html',
  styleUrls: ['./text-input.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextInputComponent), multi: true }
  ]
})
export class TextInputComponent implements OnDestroy, OnInit, ControlValueAccessor, AfterViewInit {
  public Editor = ClassicEditor;

  private readonly userService = inject(UserService)

  @ViewChild('input', { static: false, read: DefaultValueAccessor })
  defaultAccessor: ControlValueAccessor | null = null;

  @ViewChild(CKEditorComponent, { static: false })
  ckEditor: CKEditorComponent | null = null;

  private _destroy$ = new Subject<void>();

  /** The expected output format. Only valid if choices is not set. */
  @Input()
  set format(format: '' | FormatType) {
    if (format === '') { format = 'plain' };
    this._format = format;
  }
  get format() { return this._format; }
  private _format: FormatType;

  /** Available input choices. Causes text-input to render a select box. */
  @Input()
  choices: string[] | null = null;

  config: any = {
    mention: {
      feeds: [
        {
          marker: '@',
          feed: (queryText: string) => {
            return firstValueFrom(this.userService.users
              .pipe(
                map(users => {
                  return users.filter(profile => {
                    return profile.user.username.toLowerCase().includes(queryText)
                      || profile.user.firstName?.toLowerCase().includes(queryText)
                      || profile.user.displayName?.toLowerCase().includes(queryText)
                  })
                })
              )
            ).then(response => {
              return response
                .map(profile => {
                  return {
                    id: '@' + profile.user.username,
                    userId: profile.user.id,
                    name: new UserNamePipe().transform(profile),
                  }
                })
            })
          }
        }
      ]
    }
  }

  /**
   * Whether or not the input should be multiline.
   * This is only supported for "plain" format.
   * "html" is always multi-line.
   */
  @Input()
  set multiline(v: any) {
    this._multiline = coerceBooleanProperty(v);
  }
  get multiline() { return this._multiline; }
  private _multiline = false;

  _value: string = '';

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v));
  }
  get disabled() { return this._disabled; }
  private _disabled: boolean = false;

  constructor(
    private cdr: ChangeDetectorRef
  ) { }

  _onChange: (_: string) => void = () => { }
  registerOnChange(fn: (_: string) => void) {
    this._onChange = fn;
    this.defaultAccessor?.registerOnChange(this._onChange);
    this.ckEditor?.registerOnChange(this._onChange);
  }

  _onTouch: () => any = () => { };
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
