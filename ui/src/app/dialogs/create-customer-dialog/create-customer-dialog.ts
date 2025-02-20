import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
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
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from "@tierklinik-dobersberg/angular/table";
import { Customer } from "@tierklinik-dobersberg/apis/customer/v1";
import { toast } from "ngx-sonner";
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
        HlmInputDirective
    ],
    templateUrl: './create-customer-dialog.html',
})
export class CreateCustomerDialog implements OnInit {
    protected readonly number = signal('');
    protected readonly firstName = signal('');
    protected readonly lastName = signal('');

    private readonly customerService = injectCustomerService();
    private readonly _dialogRef = inject<BrnDialogRef<Customer | null>>(BrnDialogRef);
    private readonly _dialogContext = injectBrnDialogContext<CreateCustomerDialogContext>();

    ngOnInit() {
        this.number.set(this._dialogContext.caller)
    }

    static open(service: HlmDialogService, ctx: CreateCustomerDialogContext): BrnDialogRef<Customer | null> {
        return service.open(CreateCustomerDialog, {
            context: ctx,
            contentClass: DIALOG_CONTENT_CLASS,
        })
    }

    protected save() {
        this.customerService
            .updateCustomer({
                customer: {
                    phoneNumbers: [this.number()],
                    firstName: this.firstName(),
                    lastName: this.lastName(),
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