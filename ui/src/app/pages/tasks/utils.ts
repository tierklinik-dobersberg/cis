import { ColumnResize } from "@angular/cdk-experimental/column-resize";
import { coerceCssPixelValue } from "@angular/cdk/coercion";
import { AfterViewInit, Directive, ElementRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { PartialMessage } from "@bufbuild/protobuf";
import { Board, TaskGroup } from "@tierklinik-dobersberg/apis/tasks/v1";
import { registry } from "src/app/type-registry";

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


export class TaskGroupWithBoard extends TaskGroup {
    public readonly board: Board;
    public readonly value: any;

    constructor(
        group: PartialMessage<TaskGroup>,
        board: PartialMessage<Board>,
        public readonly field: string,
    ) {
        super(group)

        this.board = new Board(board);


        if (this.groupValue) {
            try {
                this.value = this.groupValue.unpack(registry).toJson() || null;
            } catch(err) {
                console.error("failed to unpack group value", this.groupValue.typeUrl, err)
            }
        } else {
            this.value = null;
        }
    }
}