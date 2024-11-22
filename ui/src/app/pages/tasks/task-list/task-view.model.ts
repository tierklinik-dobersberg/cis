import { computed, signal } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { BoardServiceClient } from "@tierklinik-dobersberg/angular/connect";
import { Sort, SortDirection } from "@tierklinik-dobersberg/apis/common/v1";
import { View } from "@tierklinik-dobersberg/apis/tasks/v1";
import { toast } from "ngx-sonner";

export class ViewModel extends View {
    private readonly _changeIndex = signal(0);

    public readonly changeIndex = this._changeIndex.asReadonly();
    public readonly isDirty = computed(() => {
        return this._changeIndex() > 0
    })

    public readonly groupByIcon = computed(() => {
        this.changeIndex();

        if (this.groupSortDirection === SortDirection.DESC) {
            return 'lucideArrowDown'
        }

        return 'lucideArrowUp'
    })

    public readonly sortByIcon = computed(() => {
        this.changeIndex();
        
        if (!!this.sort && this.sort.direction === SortDirection.DESC) {
            return 'lucideArrowDown'
        }

        return 'lucideArrowUp'
    })

    public readonly original: View;

    constructor(
        v: PartialMessage<View>,
        private readonly boardId: string,
        private readonly boardService: BoardServiceClient,
        dirty = false) {

        super(v);

        this.original = new View(v);

        if (dirty) {
            this.markDirty()
        }
    }

    markDirty() {
        this._changeIndex.set(this._changeIndex() + 1)
    }

    setFilter(filter: string) {
        this.filter = filter;

        this.markDirty();
    }

    setGroupBy(field: string) {
        if (this.groupByField === field) {
            switch (this.groupSortDirection) {
                case SortDirection.DESC:
                    this.groupSortDirection = SortDirection.ASC
                    break; 
                default:
                    this.groupSortDirection = SortDirection.DESC
            }
        } else {
            this.groupByField = field;
            this.groupSortDirection = SortDirection.ASC
        }

        this.markDirty();
    }

    setSort(field: string) {
        if (!!this.sort && this.sort.fieldName === field) {
            switch (this.sort.direction) {
                case SortDirection.DESC:
                    this.sort.direction = SortDirection.ASC
                    break; 
                default:
                    this.sort.direction = SortDirection.DESC
            }
        } else {
            this.sort = new Sort({
                fieldName: field,
                direction: SortDirection.ASC,
            })
        }


        this.markDirty();
    }

    delete() {
        this.boardService
            .deleteView({
                boardId: this.boardId,
                viewName: this.name,
            })
            .catch(err => {
                toast.error('Board konnte nicht gelöscht werden', {
                    description: ConnectError.from(err).message,
                })
            })
    }

    save() {
        this.boardService
            .addView({
                boardId: this.boardId,
                view: this
            })
            .then(() => this._changeIndex.set(0))
            .catch(err => {
                toast.error('Board konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message,
                })
            })
    }
}