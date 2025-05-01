import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ConnectError } from '@connectrpc/connect';
import { HlmBadgeDirective } from '@tierklinik-dobersberg/angular/badge';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { injectLongRunning } from '@tierklinik-dobersberg/angular/connect';
import { DisplayNamePipe, ToDatePipe, ToUserPipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { Operation, OperationState, QueryOperationsResponse } from '@tierklinik-dobersberg/apis/longrunning/v1';
import { toast } from 'ngx-sonner';
import { catchError, interval, merge, of, startWith, switchMap } from 'rxjs';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { EventService } from 'src/app/services/event.service';

@Component({
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './operations.component.html',
    imports: [
        HlmTableModule,
        ToUserPipe,
        DisplayNamePipe,
        HlmBadgeDirective,
        ToDatePipe,
        DatePipe
    ],
})
export class OperationsComponent implements OnInit {
    private readonly longRunning = injectLongRunning();
    private readonly headerService = inject(HeaderTitleService);
    private readonly events = inject(EventService)
    protected readonly operations = signal<Operation[]>([]);
    protected readonly profiles = injectUserProfiles();


    protected readonly states = OperationState;

    ngOnInit(): void {
        this.headerService.set('Background Tasks', 'Eine übersicht über die letzten Background-Tasks')

        merge([
            interval(10 * 1000),
            this.events.listen([new Operation]),
        ])
            .pipe(
                startWith(0),
                switchMap(() => {
                    return this.longRunning
                        .queryOperations({})
                }),
                catchError(err => {
                    toast.error('Failed to load operations', {
                        description: ConnectError.from(err).message
                    })
                    return of(new QueryOperationsResponse())
                })
            )
            .subscribe(res => {
                this.operations.set(res.operation || [])
            })
    }
}