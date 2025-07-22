import { effect, inject, Injectable, signal } from "@angular/core";
import { Timestamp } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { BrnDialogRef } from "@spartan-ng/ui-dialog-brain";
import { injectCallService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { GetOverwriteResponse, OnCallChangeEvent, Overwrite } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { toast } from "ngx-sonner";
import { EventService } from "src/app/services/event.service";

@Injectable({providedIn: 'root'})
export class EmergencyTargetService {
  private readonly callService = injectCallService();
  private readonly dialogService = inject(HlmDialogService)
  private readonly _target = signal<Overwrite | null>(null)

  public readonly target = this._target.asReadonly();

  private readonly _update = signal<Date>(new Date());
  public readonly shouldUpdate = this._update.asReadonly();

  private eventService = inject(EventService);
  
  constructor() {
    // only ever load the current overwrite if we got a
    // OnCallChangeEvent
    this.eventService
      .subscribe(new OnCallChangeEvent)
      .subscribe(event => {
        console.log("recieved OnCallChangeEvent, fetching active overwrite")
        this._update.set(new Date())
      })

    effect(() => {
      this._update();
      this.load();
    })
  }

  async createRedirect(inboundNumber?: string): Promise<BrnDialogRef> {
    const m = await import("./create-overwrite-dialog");
    const ref = this.dialogService.open(m.CreateOverwriteComponent, {
      contentClass: 'max-w-full w-full h-[100dvh] sm:h-[unset] max-w-[unset] md:max-w-[unset]',
      context: {
        inboundNumber
      }
    });
    ref.closed$
      .subscribe(() => this.load());
    return ref;
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