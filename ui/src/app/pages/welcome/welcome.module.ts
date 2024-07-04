import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SharedModule } from 'src/app/shared/shared.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ClockCardComponent } from './clock-card';
import { DoorCardComponent } from './door-card';
import { EmergencyCardComponent } from './emergency-card';
import { VoiceMailCardComponent } from './mail-card';
import { MobileWelcomeCardComponent } from './mobile-welcome-card';
import { RosterCardComponent } from './roster-card';
import { UpcomingEventsCardComponent } from './upcoming-events-card';
import { WelcomeRoutingModule } from './welcome-routing.module';
import { WelcomeComponent } from './welcome.component';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';

@NgModule({
  imports: [
    WelcomeRoutingModule,
    CommonModule,
    FormsModule,
    DragDropModule,
    NzGridModule,
    NzCardModule,
    NzIconModule,
    NzAvatarModule,
    NzSelectModule,
    NzCalendarModule,
    NzFormModule,
    NzListModule,
    NzInputModule,
    NzMessageModule,
    NzDrawerModule,
    NzTimePickerModule,
    NzButtonModule,
    NzResultModule,
    NzPopoverModule,
    NzDividerModule,
    NzPopconfirmModule,
    NzStepsModule,
    NzToolTipModule,
    NzDropDownModule,
    NzSpinModule,
    NzStatisticModule,
    NzEmptyModule,
    NzBadgeModule,
    CalendarModule,
    SharedModule,
    HlmButtonDirective
  ],
  declarations: [
    WelcomeComponent,
    DoorCardComponent,
    ClockCardComponent,
    EmergencyCardComponent,
    RosterCardComponent,
    VoiceMailCardComponent,
    UpcomingEventsCardComponent,
    MobileWelcomeCardComponent,
  ],
  exports: [WelcomeComponent]
})
export class WelcomeModule {}
