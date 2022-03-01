import { coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output,
  TrackByFunction,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { OptionSpec, Schema, SchemaInstance } from 'src/app/api';

@Component({
  selector: 'app-setting-editor',
  templateUrl: './setting-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => SettingEditorComponent),
    },
  ],
})
export class SettingEditorComponent implements ControlValueAccessor {
  @Input()
  set showIndex(v: any) {
    this._showIndex = coerceBooleanProperty(v);
  }
  get showIndex() {
    return this._showIndex;
  }
  private _showIndex = true;

  @Input()
  set showHeader(v: any) {
    this._showHeader = coerceBooleanProperty(v);
  }
  get showHeader() {
    return this._showHeader;
  }
  private _showHeader = true;

  @Input()
  schema: Schema | null = null;

  @Input()
  value: SchemaInstance = {};

  @Output()
  valueChange = new EventEmitter<{ [key: string]: any }>();

  @Input()
  set disabled(v: any) {
    this.setDisabledState(coerceBooleanProperty(v));
  }
  get disabled() {
    return this._disabled;
  }
  private _disabled = false;

  constructor(private cdr: ChangeDetectorRef) {}

  writeValue(obj: SchemaInstance): void {
    obj = obj || {};
    this.value = obj;
    this.valueChange.next(obj);
    this.cdr.markForCheck();
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
    this.cdr.markForCheck();
  }

  _onChange: (v: SchemaInstance) => void = () => {};
  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  _onBlur: () => void = () => {};
  registerOnTouched(fn: any): void {
    this._onBlur = fn;
  }
}
