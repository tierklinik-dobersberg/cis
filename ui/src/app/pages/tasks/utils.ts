import { ColumnResize } from "@angular/cdk-experimental/column-resize";
import { coerceCssPixelValue } from "@angular/cdk/coercion";
import { AfterViewInit, Directive, ElementRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Directive()
export abstract class ResizableComponentWidth implements AfterViewInit {
    protected readonly resize = inject<ColumnResize>(ColumnResize, {optional: true})
    protected readonly element = inject(ElementRef);
    protected readonly componentWidth = signal<string>('unset')

    ngAfterViewInit(): void {
        if (this.resize) {
            this.componentWidth.set(
                coerceCssPixelValue(
                    this.element.nativeElement.getBoundingClientRect().width
                )
            );
        }
    }

    constructor() {
        if (this.resize) {
            this.resize
                .columnResizeNotifier
                .resizeCompleted
                .pipe(takeUntilDestroyed())
                .subscribe(() => {
                    this.componentWidth.set(
                        coerceCssPixelValue(
                            this.element.nativeElement.getBoundingClientRect().width
                        )
                    )
                })
        }
    }
}