import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzResultModule } from 'ng-zorro-antd/result';

import { WelcomeRoutingModule } from './welcome-routing.module';

import { WelcomeComponent } from './welcome.component';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { NzIconModule, NzIconService } from 'ng-zorro-antd/icon';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';


@NgModule({
  imports: [
    WelcomeRoutingModule,
    CommonModule,
    FormsModule,
    DragDropModule,
    NzGridModule,
    NzCardModule,
    FontAwesomeModule,
    NzIconModule,
    NzAvatarModule,
    NzSelectModule,
    NzCalendarModule,
    NzFormModule,
    NzListModule,
    NzInputModule,
    NzTimePickerModule,
    NzButtonModule,
    NzResultModule,
    NzDividerModule,
    NzStepsModule,
    NzToolTipModule
  ],
  declarations: [WelcomeComponent],
  exports: [WelcomeComponent]
})
export class WelcomeModule {
  constructor(library: FaIconLibrary, iconService: NzIconService) {
    library.addIconPacks(fas, far);
  }
}