import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal
} from '@angular/core';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { DisplayNamePipe } from '@tierklinik-dobersberg/angular/pipes';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import { DateSwiperComponent } from 'src/app/components/date-swiper/date-swiper.component';
import { SwiperContentDirective } from 'src/app/components/swiper/swiper-content.directive';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { CalendarIdPipe } from 'src/app/pipes/by-calendar-id.pipe';
import { injectCurrentUserIsAdmin } from 'src/app/services';
import { injectStoredProfile } from 'src/app/utils/inject-helpers';
import { EmergencyCardComponent } from './emergency-card';
import { MobileWelcomeCardComponent } from './mobile-welcome-card';
import { RosterCardComponent } from './roster-card';
import { StudyCardComponent } from './study-card';
import { UpcomingEventsCardComponent } from './upcoming-events-card';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MobileWelcomeCardComponent,
    EmergencyCardComponent,
    UpcomingEventsCardComponent,
    RosterCardComponent,
    CalendarIdPipe,
    StudyCardComponent,
    DateSwiperComponent,
    SwiperContentDirective,
  ],
  host: {
    'class': '@container'
  }
})
export class WelcomeComponent {
  private readonly header = inject(HeaderTitleService);

  public readonly layout = inject(LayoutService);

  protected testList = [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f"
  ]

  protected readonly dateType = Date.prototype;
  protected readonly currentUser = injectStoredProfile();
  protected readonly hoveredUser = signal<Profile | null>(null);
  protected readonly showStudyCard = injectCurrentUserIsAdmin();

  constructor() {
    effect(() => {
      const profile = this.currentUser();
      const name = new DisplayNamePipe().transform(profile);

      this.header.set(
        `Hallo ${name},`,
        'Hier findest du eine Übersicht der wichtigsten Informationen.'
      );
    });
  }
}
