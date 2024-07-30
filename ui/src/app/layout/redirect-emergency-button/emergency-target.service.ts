import { inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Timestamp } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { BrnDialogRef } from "@spartan-ng/ui-dialog-brain";
import { injectCallService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { GetOverwriteResponse, Overwrite } from "@tierklinik-dobersberg/apis";
import { toast } from "ngx-sonner";
import { interval, startWith } from "rxjs";

@Injectable({providedIn: 'root'})
export class EmergencyTargetService {
  private readonly callService = injectCallService();
  private readonly dialogService = inject(HlmDialogService)
  private readonly _target = signal<Overwrite | null>(null)
  public readonly target = this._target.asReadonly();
  
  constructor() {
    interval(10000)
      .pipe(startWith(0), takeUntilDestroyed())
      .subscribe(() => this.load())
  }

  createRedirect(): Promise<BrnDialogRef> {
    return import("../../dialogs/create-overwrite-dialog")
      .then(m => {
        const ref = this.dialogService.open(m.CreateOverwriteComponent, {
            contentClass: 'w-full h-[100dvh] sm:h-[unset] max-w-[unset] md:max-w-[unset]'
        })

        ref.closed$
          .subscribe(() => this.load())

        return ref;
      })
  }
  
  public load() {
    this.callService
      .getOverwrite({
        selector: {
          case: 'activeAt',
          value: Timestamp.fromDate(new Date())
        }
      })
      .catch(err => {
          const cerr = ConnectError.from(err);
          if (cerr.code !== Code.NotFound) {
            toast.error('Telefon-Umleitung konnte nicht geladen werden', {
              description: cerr.message,
            })
          }

          return new GetOverwriteResponse()
      })
      .then(response => {
        if (!response.overwrites?.length) {
          this._target.set(null)
          return;
        }
        
        this._target.set(response.overwrites[0])
      })
  }
}