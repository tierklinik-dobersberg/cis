import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  TemplateRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  ConfigAPI,
  OptionSpec,
  PossibleValue,
  StringFormatAnnotation,
  WellKnownAnnotations,
} from 'src/app/api';
import { coerceBooleanProperty } from '@angular/cdk/coercion';
import  ClassicEditor  from '@tierklinik-dobersberg/ckeditor-build';

export type NamedOptionSpec = OptionSpec & { displayName?: string };

@Component({
  /* eslint '@angular-eslint/component-selector': 'off' */
  selector: 'tkd-option-spec-input',
  templateUrl: './option-spec-input.html',
  styleUrls: ['./option-spec-input.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => TkdOptionSpecInputComponent),
    },
  ],
})
export class TkdOptionSpecInputComponent
  implements ControlValueAccessor, OnChanges
{
  public readonly Editor = ClassicEditor;

  private _disabled = false;

  @Input()
  index: string | number | null = null;

  @Input()
  spec: NamedOptionSpec | null = null;

  @Input()
  value: any;

  @Output()
  valueChange = new EventEmitter<any>();

  /** Whether or not the current spec is a slice type */
  isSliceType = false;

  /** for strings only: Whether or not the current spec describes a secret */
  isSecret = false;

  /** for strings only: whether or not the current spec is interpreted as markdown */
  isMarkdown = false;

  /** for strings only: whether or not the current spec is multi-line plain-text string */
  isPlainText = false;

  /** whether or not custom values are allowed. */
  allowCustomValues = false;

  /** whether or not the option is marked as read-only */
  isReadonly = false;

  /** a list of possible values for the current spec */
  possibleValues: PossibleValue[] | null = null;

  @Input()
  inputHeadSlot: TemplateRef<any> | undefined;

  @Input()
  inputTailSlot: TemplateRef<any> | undefined;

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v));
  }
  get disabled() {
    return this._disabled;
  }

  constructor(private configapi: ConfigAPI, private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if ('spec' in changes) {
      this.isSecret = this.configapi.hasAnnotation(
        changes.spec.currentValue,
        WellKnownAnnotations.Secret
      );

      this.isSliceType =
        (changes.spec.currentValue as OptionSpec).type?.includes('[]') || false;

      const format: StringFormatAnnotation = this.configapi.getAnnotation(changes.spec.currentValue, WellKnownAnnotations.StringFormat)
      if (!!format && typeof format.format === 'string') {
        this.isMarkdown = format.format === 'text/markdown';
        this.isPlainText = format.format === 'text/plain';
      } else {
        this.isMarkdown = false;
        this.isPlainText = false;
      }
      this.allowCustomValues = this.configapi.customValueAllowed(changes.spec.currentValue);

      this.isReadonly = this.configapi.hasAnnotation(changes.spec.currentValue, WellKnownAnnotations.Readonly ) || this._disabled

      this.configapi
        .resolvePossibleValues(changes.spec.currentValue)
        .then((values) => {
          this.possibleValues = values;
          this.cdr.markForCheck();
        });
    }
  }

  writeValue(obj: any): void {
    this.value = obj;
    this.valueChange.next(obj);
    this.cdr.markForCheck();
  }

  _onChanged: (v: any) => void = () => {};
  registerOnChange(fn: any): void {
    this._onChanged = fn;
  }

  _onBlur: () => void = () => {};
  registerOnTouched(fn: any): void {
    this._onBlur = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
    if (this._disabled) {
      this.isReadonly = true;
    } else {
      this.isReadonly = this.configapi.hasAnnotation(this.spec, WellKnownAnnotations.Readonly ) || this._disabled
    }
    this.cdr.markForCheck();
  }
}
