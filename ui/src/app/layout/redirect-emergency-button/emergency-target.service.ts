import { DestroyRef, inject, Injectable } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Timestamp } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { injectCallService } from "@tierklinik-dobersberg/angular/connect";
import { DisplayNamePipe } from "@tierklinik-dobersberg/angular/pipes";
import { GetOverwriteResponse } from "@tierklinik-dobersberg/apis";
import { BehaviorSubject, map, mergeAll, of, repeat, switchMap, tap } from "rxjs";
import { UserService } from "src/app/api";

@Injectable({providedIn: 'root'})
export class EmergencyTargetService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly callService = injectCallService();
  private readonly userService = inject(UserService);

  /** Used to trigger a reload of the current overwrite target */
  private reloadOverwrite$ = new BehaviorSubject<void>(undefined);
  
  public reload() {
    this.reloadOverwrite$.next();
  }

  /** The target of the current roster overwrite if any */
  public readonly overwriteTarget = toSignal(
    this.reloadOverwrite$
      .pipe(
        repeat({ delay: 20000 }),
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          this.callService.getOverwrite({
            selector: {
              case: 'activeAt',
              value: Timestamp.fromDate(new Date()),
            }
          }).catch(err => {
            const cerr = ConnectError.from(err);
            if (cerr.code !== Code.NotFound) {
              console.log(cerr)
            }

            return new GetOverwriteResponse()
          })
        ),
        map(overwrite => {
          console.log("overwrites", overwrite);

          if (!overwrite.overwrites?.length) {
            return '';
          }

          const first = overwrite.overwrites[0];

          switch (first.target.case) {
            case 'custom':
              return of(first.target.value.displayName || first.target.value.transferTarget);

            case 'userId':
              const id = first.target.value;
              return this.userService.updated
                  .pipe(map(() => {
                    return (new DisplayNamePipe().transform(this.userService.byId(id))) || 'Unknown'
                  }));

            default:
              console.error("Unsupported overwrite target")
              return '';
          }
        }), tap(res => console.log("overwrite result", res)), mergeAll()));
}