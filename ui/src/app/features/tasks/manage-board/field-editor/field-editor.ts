import { ChangeDetectionStrategy, Component, computed, input, model } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { lucideTrash2 } from "@ng-icons/lucide";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { TaskPriority, TaskStatus, TaskTag } from "@tierklinik-dobersberg/apis/tasks/v1";
import { NgxColorsModule } from "ngx-colors";

type Model = {
    name: string;
    value?: number;
    color: string;
    description: string;
}

type Columns = keyof Model;

@Component({
    selector: 'app-field-editor',
    standalone: true,
    templateUrl: './field-editor.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        HlmIconModule,
        HlmBadgeDirective,
        NgxColorsModule,
        HlmTableModule,
        HlmLabelDirective,
        HlmInputDirective,
        FormsModule,
    ],
    providers: [
        ...provideIcons({lucideTrash2})
    ]
})
export class FieldEditorComponent<T extends (TaskStatus | TaskPriority | TaskTag)> {
    public readonly values = model.required<T[]>(); 

    public readonly type = input.required<T>();

    protected readonly models = computed<Model[]>(() => {
        const values = this.values();

        return values.map(v => {
            if (v instanceof TaskStatus) {
                return {
                    name: v.status,
                    color: v.color,
                    description: v.description
                }
            }

            if (v instanceof TaskTag) {
                return {
                    name: v.tag,
                    color: v.color,
                    description: v.description,
                }
            }

            return {
                name: v.name,
                value: v.priority,
                color: v.color,
                description: v.descritpion,
            }
        })
    })

    protected readonly displayedColumns = computed(() => {
        const cols: Columns[] = [
            'name',
            'description',
            'color'
        ]

        if (this.type() instanceof TaskPriority) {
            cols.splice(1, 0, 'value')
        }

        return cols
    })

    protected readonly computedColumnNames = computed<{ [key in Columns]: string }>(() => {
        const t = this.type();

        const result: {
            [key in Columns]: string
        } = {
            'description': 'Beschreibung',
            'color': 'Farbe',
            'value': 'Wert',
            'name': ''
        }

        if (t instanceof TaskStatus) {
            result['name'] = 'Status'
        }

        if (t instanceof TaskTag) {
            result['name'] = 'Tag'
        }

        if (t instanceof TaskPriority) {
            result['name'] = 'Priorität'
        }

        return result
    })

    protected updateFieldValue<K extends keyof Model, V extends Model[K]>(idx: number, col: K, value: V) {
        const list = [
            ...this.models()
        ];

        const element: Model = list[idx];
        element[col] = value;

        const type = this.type();

        const values: T[] = list.map(e => {
            if (type instanceof TaskStatus) {
                return new TaskStatus({
                    status: e.name,
                    ...e,
                })
            }

            if (type instanceof TaskPriority) {
                return new TaskPriority({
                    priority: +e.value,
                    ...e,
                })
            }

            return new TaskTag({
                tag: e.name,
                ...e
            })
        }) as T[];

        this.values.set(values);
    }

    protected removeElement(idx: number) {
        const values = [...this.values()]
        values.splice(idx, 1)
        this.values.set(values);
    }

    protected addElement() {
        const values = [...this.values()]
        const type = this.type();

        if (type instanceof TaskStatus) {
            values.push(new TaskStatus() as T)
        }

        if (type instanceof TaskPriority) {
            values.push(new TaskPriority() as T)
        }

        if (type instanceof TaskTag) {
            values.push(new TaskTag() as T)
        }

        this.values.set(values)
    }
}