import { DestroyRef, inject, Injectable, InjectionToken, Injector, Provider, RendererFactory2, runInInjectionContext, Type } from '@angular/core';
import { BrnDialogRef } from '@spartan-ng/ui-dialog-brain';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';

export type HotKeyAction =
  | {
      onClick: (event: KeyboardEvent) => void;
    }
  | {
      componentType: Type<any> & {
        open(service: HlmDialogService, ctx?: unknown): unknown;
        lastRef?: BrnDialogRef<unknown>;
      };
    };

export type HotKey = {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
} & HotKeyAction;

export const HOT_KEY = new InjectionToken<HotKey[]>('HOT_KEY');

export function provideHotKeys(hks: HotKey[]): Provider[] {
    return hks.map(hk => {
        return {
            provide: HOT_KEY,
            useValue: hk,
            multi: true,
        }
    })
}

@Injectable({
  providedIn: 'root',
})
export class HotKeyManagementService {
  private readonly hotKeys = inject(HOT_KEY);
  private readonly rendererFactory = inject(RendererFactory2)
  private readonly injector = inject(Injector)
  private readonly dialogService = inject(HlmDialogService)

  constructor() {
    const renderer = this.rendererFactory.createRenderer(null, null)

    const unlisten = renderer
        .listen('document', 'keydown', (event) => this.handleKeyDown(event))

    inject(DestroyRef)
        .onDestroy(unlisten)
  }

  private handleKeyDown(event: KeyboardEvent) {
    let found = false;

    this.hotKeys
        .forEach(hk => {
            const altMatches = hk.altKey === undefined || hk.altKey === event.altKey;
            const shiftMatches = hk.shiftKey === undefined || hk.shiftKey === event.shiftKey;
            const ctrlMatches = hk.ctrlKey === undefined || hk.ctrlKey === event.ctrlKey;

            if (altMatches && shiftMatches && ctrlMatches && hk.key === event.key) {
                found = true;

                if ('onClick' in hk) {
                    runInInjectionContext(this.injector, () => hk.onClick(event)) 
                } else {
                    if (hk.componentType.lastRef) {
                        hk.componentType.lastRef.close();
                    } else {
                        hk.componentType.open(this.dialogService)
                    }
                }
            }
        })

    if (found) {
        event.preventDefault();
    }
  }
}
