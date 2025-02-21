import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectCustomerService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from "@tierklinik-dobersberg/angular/table";
import { Customer, SearchCustomerResponse } from "@tierklinik-dobersberg/apis/customer/v1";
import { toast } from "ngx-sonner";
import { debounceTime, filter, Subject, switchMap } from "rxjs";
import { DIALOG_CONTENT_CLASS } from "../constants";

export interface CreateCustomerDialogContext {
    caller: string
}

@Component({
    standalone: true,
    imports: [
        HlmDialogHeaderComponent,
        HlmDialogDescriptionDirective,
        HlmDialogTitleDirective,
        HlmDialogFooterComponent,
        HlmButtonDirective,
        HlmTableComponent,
        HlmThComponent,
        HlmTrowComponent,
        HlmTdComponent,
        HlmIconModule,
        BrnSelectModule,
        HlmSelectModule,
        FormsModule,
        BrnAlertDialogModule,
        HlmAlertDialogModule,
        CKEditorModule,
        MatAutocompleteModule,
        HlmInputDirective,
        HlmLabelDirective,
    ],
    templateUrl: './create-customer-dialog.html',
})
export class CreateCustomerDialog implements OnInit {
    protected readonly number = signal('');
    protected readonly firstName = signal('');
    protected readonly lastName = signal('');
    protected readonly matchingCustomers = signal<Customer[]>([]);
    protected readonly existingCustomerId = signal<string | null>(null);

    private readonly customerService = injectCustomerService();
    private readonly _dialogRef = inject<BrnDialogRef<Customer | null>>(BrnDialogRef);
    private readonly _dialogContext = injectBrnDialogContext<CreateCustomerDialogContext>();
    private readonly destroyRef = inject(DestroyRef)

    ngOnInit() {
        this.number.set(this._dialogContext.caller)

        this.debouncedSearch$
            .pipe(
                takeUntilDestroyed(this.destroyRef),
                debounceTime(100),
                filter(value => value.length > 2), // onyl search for customers once we have at least 3 characters to search
                filter(() => this.existingCustomerId() === null),
                switchMap(searchValue => {
                    const abrt = new AbortController()

                    const promise = this.customerService
                        .searchCustomer({
                            queries: [
                                {
                                    query: {
                                        case: 'name',
                                        value: {
                                            lastName: searchValue
                                        },
                                    }
                                }
                            ]
                        }, { signal: abrt.signal })
                        .catch((err) => {
                            toast.error('Kundendaten konnten nicht durchsucht werden', {
                                description: ConnectError.from(err).message
                            })

                            return new SearchCustomerResponse()
                        })
                        .finally(() => abrt.abort())

                    return promise
                }),
            )
            .subscribe(response => {
                this.matchingCustomers.set(
                    (response.results || [])
                        .map(r => r.customer)
                )
            })
    }

    static open(service: HlmDialogService, ctx: CreateCustomerDialogContext): BrnDialogRef<Customer | null> {
        return service.open(CreateCustomerDialog, {
            context: ctx,
            contentClass: DIALOG_CONTENT_CLASS,
        })
    }

    private readonly debouncedSearch$ = new Subject<string>();

    protected searchCustomer(name: string) {
        if (name.length < 3) {
            this.matchingCustomers.set([]);
        }

        this.debouncedSearch$
            .next(name)
    }

    protected onCustomerSelected(customer: Customer) {
        this.existingCustomerId.set(customer.id);
        this.firstName.set(customer.firstName);
    }

    protected customerName(c: Customer) {
        return c.lastName
    }

    protected save() {
        this.customerService
            .updateCustomer({
                customer: {
                    phoneNumbers: [this.number()],
                    firstName: this.firstName(),
                    lastName: this.lastName(),
                    id: this.existingCustomerId(),
                }
            })
            .then((respose) => {
                this._dialogRef.close(respose.response.customer);
            })
            .catch( err => {
                toast.error('Kunde konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected close() {
        this._dialogRef.close(null);
    }
}