import { coerceBooleanProperty, coerceNumberProperty } from '@angular/cdk/coercion';
import { Component, forwardRef, HostListener, Input, OnChanges, TrackByFunction } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { InfoScreenAPI, Variable } from 'src/app/api/infoscreen.api';
import { extractErrorMessage } from 'src/app/utils';

@Component({
    selector: 'app-show-editor-input',
    templateUrl: './editor-input.html',
    styleUrls: ['./editor-input.scss'],
    providers: [
        { provide: NG_VALUE_ACCESSOR, multi: true, useExisting: forwardRef(() => LayoutVariableInputComponent) }
    ]
})
export class LayoutVariableInputComponent implements ControlValueAccessor, OnChanges {
    values: any[] = [];

    private _onChange: (_: any[]) => void = () => { }
    private _onTouch: () => void = () => { }

    @Input()
    item: Variable | null = null;

    @Input()
    layout: string = '';

    @Input()
    showName: string = '';

    @Input()
    set previewIndex(v: any) {
        this._previewIndex = coerceNumberProperty(v);
    }
    get previewIndex() {
        return this._previewIndex;
    }
    private _previewIndex: number = -1;

    /** Whether or not the inputs should be disabled */
    @Input()
    set disabled(v: any) {
        this._disabled = coerceBooleanProperty(v);
    }
    get disabled() {
        return this._disabled;
    }
    private _disabled = false;

    ngOnChanges() {
        if (!this.item.multi && this.values.length === 0) {
            this.addValue();
        }
    }

    @HostListener('blur')
    onBlur() { this._onTouch() }

    constructor(
        private showAPI: InfoScreenAPI,
        private nzMessage: NzMessageService,
    ) { }

    trackByIndex: TrackByFunction<any> = (index: number) => index;

    addValue() {
        this.values = [
            ...this.values,
            this.showAPI.emptyValue(this.item)
        ];
    }

    deleteValue(index: number) {
        this.values.splice(index, 1);
        this.values = [...this.values];
        this.valueChanged();
    }

    hasEmptyValue() {
        let empty = this.showAPI.emptyValue({
            ...this.item,
            multi: false
        });

        return this.values.some(val => val === empty);
    }

    uploadAsset(index: number, event?: Event) {
        if (!this.item) {
            return
        }

        const file = (event?.target as HTMLInputElement)?.files[0];
        if (!file) {
            this.values.splice(index, 1);
            this.values = [...this.values];
            return;
        }

        this.showAPI.uploadAsset(this.layout, this.item.name, file)
            .subscribe({
                next: name => {
                    this.values[index] = name;
                    this.valueChanged();
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Datei konnte nicht hochgeladen werden'))
                }
            });
    }

    writeValue(values: any[] | any): void {
        if (Array.isArray(values)) {
            this.values = values;
        } else {
            this.values = [values];
        }
    }

    registerOnChange(fn: (_: any[]) => void): void {
        this._onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this._onTouch = fn;
    }

    setDisabledState(isDisabled: boolean): void {
        this.disabled = isDisabled;
    }

    valueChanged() {
        if (this.item.multi) {
            this._onChange(this.values);
        } else {
            this._onChange(this.values[0]);
        }
    }
}