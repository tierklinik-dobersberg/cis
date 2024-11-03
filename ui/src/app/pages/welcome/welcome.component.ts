import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal
} from '@angular/core';
import { injectCurrentProfile } from '@tierklinik-dobersberg/angular/behaviors';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { DisplayNamePipe } from '@tierklinik-dobersberg/angular/pipes';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { CalendarIdPipe } from 'src/app/pipes/by-calendar-id.pipe';
import { injectCurrentUserIsAdmin } from 'src/app/services';
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
  ],
  host: {
    'class': '@container'
  }
})
export class WelcomeComponent {
  private readonly header = inject(HeaderTitleService);

  public readonly layout = inject(LayoutService);

  protected readonly currentUser = injectCurrentProfile();
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
