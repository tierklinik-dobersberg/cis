import { animate, style, transition, trigger } from '@angular/animations';
import { ActiveDescendantKeyManager } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  AfterViewInit,
  Component,
  ComponentRef,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgModel } from '@angular/forms';
import { ConnectError } from '@connectrpc/connect';
import { hlm } from '@spartan-ng/ui-core';
import { injectTreatmentService } from '@tierklinik-dobersberg/angular/connect';
import { Treatment } from '@tierklinik-dobersberg/apis/treatment/v1';
import { toast } from 'ngx-sonner';
import { debounceTime, Subject } from 'rxjs';

@Component({
  standalone: true,
  selector: 'li[treatment]',
  template: '<ng-content />',
  host: {
    '[class]': 'classes()',
  },
})
export class TreatmentItemComponent {
  public readonly treatment = input('');

  private readonly active = signal(false);
  protected readonly classes = computed(() => {
    const a = this.active();

    let cls = 'p-2 cursor-pointer rounded';

    if (a) {
      cls = hlm(cls, 'bg-gray-100');
    }
    return cls;
  });

  getLabel() {
    return this.treatment();
  }

  setActiveStyles() {
    this.active.set(true);
  }

  setInactiveStyles() {
    this.active.set(false);
  }
}

@Component({
  standalone: true,
  templateUrl: './treatment-autocomplete-overlay.component.html',
  imports: [TreatmentItemComponent],
  host: {
    class: 'border-border border shadow-lg bg-white p-2 w-full overflow-hidden',
    '[@animate]': 'true',
  },
  animations: [
    trigger('animate', [
      transition('void => *', [
        style({
          opacity: 0,
          height: 0,
          transform: 'translateY(-100%)',
        }),
        animate(
          '250ms ease-in-out',
          style({
            opacity: 1,
            height: 'unset',
            transform: 'translateY(0)',
          })
        ),
      ]),
      transition('* => void', [
        animate(
          '1s ease-in-out',
          style({
            height: '0',
            opacity: 0,
          })
        ),
      ]),
    ]),
  ],
})
export class TreatmentAutocompleteOverlayComponent implements AfterViewInit {
  public readonly treatments = input<Treatment[]>([]);
  public readonly treatementSelected = output<Treatment>();

  @ViewChildren(TreatmentItemComponent)
  private readonly items: QueryList<TreatmentItemComponent>;
  private listManager!: ActiveDescendantKeyManager<TreatmentItemComponent>;

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        this.treatementSelected.emit(
            this.treatments()[this.listManager.activeItemIndex]
        ) 
        return
    }

    this.listManager?.onKeydown(event);
  }

  ngAfterViewInit(): void {
    this.listManager = new ActiveDescendantKeyManager(this.items)
      .withTypeAhead()
      .withWrap();
  }

  onMouseEnter(t: Treatment) {
    this.listManager?.setActiveItem(
        this.treatments().findIndex(i => i === t)
    )
  }
}

@Directive({
  standalone: true,
  selector: 'input[treatmentAutocomplete]',
})
export class TreatmentAutocompleteDirective implements OnInit, OnDestroy {
  private readonly host: ElementRef<HTMLInputElement> = inject(ElementRef);
  private readonly ngModel = inject(NgModel);
  private readonly treatmentService = injectTreatmentService();
  private readonly debounce = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);
  private readonly overlay = inject(Overlay);

  private readonly treatements = signal<Treatment[]>([]);
  private readonly availableTreatments = computed(() => {
    const all = this.treatements();
    const selected = this.selectedTreatments(); 

    return all.filter(a => selected.find(s => s.name === a.name) === undefined)
  })

  public readonly selectedTreatments = model<Treatment[]>([]);
  public readonly treatmentSelected = output<Treatment>();

  private overlayRef: OverlayRef | null = null;
  private compRef: ComponentRef<TreatmentAutocompleteOverlayComponent> | null =
    null;

  ngOnDestroy(): void {
    this.hide();
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    this.compRef?.instance.onKeyDown(event);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
        this.hide()
        clearTimeout(this.hideTimeout)
        this.hideTimeout = null;
    })

    effect(() => {
        const treatments = this.availableTreatments();

        if (treatments.length === 0) {
            this.hide()
            return
        }

        this.show();
        this.compRef
            ?.setInput('treatments', treatments)
    }, { allowSignalWrites: true })
  }

  ngOnInit() {
    let abrt: AbortController;
    this.ngModel.update.subscribe((value: string) => {
      this.debounce.next(value);
    });

    this.debounce
      .pipe(debounceTime(100), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (abrt) {
          abrt.abort();
        }

        if (value === '') {
          this.hide();

          return;
        }

        abrt = new AbortController();
        this.treatmentService
          .listTreatments({
            displayNameSearch: value,
          })
          .then(response => {
            if (!response.treatments?.length) {
              this.hide();
            } else {
              this.treatements.set(response.treatments || [])
            }
          })
          .catch(err => {
            toast.error('Behandlungen konnte nicht durchsucht werden', {
              description: ConnectError.from(err).message,
            });
          });
      });
  }

  private show() {
    if (this.overlayRef) {
      return;
    }
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.host)
        .withDefaultOffsetY(1)
        .withPositions([
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'start',
            overlayY: 'top',
          },
          {
            originX: 'start',
            originY: 'top',
            overlayX: 'start',
            overlayY: 'bottom',
          },
        ]),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      width: this.host.nativeElement.getBoundingClientRect().width,
      disposeOnNavigation: true,
    });

    this.overlayRef
        .outsidePointerEvents()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.hide())

    this.compRef = this.overlayRef.attach(
      new ComponentPortal(TreatmentAutocompleteOverlayComponent)
    );

    this.compRef
        .onDestroy(() => {
            this.overlayRef?.dispose();
            this.overlayRef = null;
            this.compRef = null
        })

    this.compRef
        .instance
        .treatementSelected
        .subscribe(t => {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;

            const value: string = this.ngModel.model;
            const newValue: string = (value.split(' ').slice(0, -1).join(' ') + ' ' + (t.displayName || t.name)).trim() + ' ';

            this.ngModel.reset(newValue);

            this.treatmentSelected.emit(t)
            this.selectedTreatments.set([
                ...this.selectedTreatments(),
                t
            ])
        })
  }

  private hideTimeout = null;

  @HostListener('blur')
  protected hide() {
    this.hideTimeout = setTimeout(() => {
        this.overlayRef?.detach();
        this.hideTimeout = null
    }, 100)
  }
}
