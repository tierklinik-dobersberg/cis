import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzMessageServiceModule } from 'ng-zorro-antd/message';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { SharedModule } from 'src/app/shared/shared.module';
import { VoiceMailComponent } from './voicemail.component';
import { VoiceMailsRoutingModule } from './voicemails-routing.module';

@NgModule({
    imports: [
        CommonModule,
        SharedModule,
        VoiceMailsRoutingModule,
        CommonModule,
        FormsModule,
        NzGridModule,
        NzCardModule,
        FontAwesomeModule,
        NzIconModule,
        NzAvatarModule,
        NzCalendarModule,
        NzFormModule,
        NzDatePickerModule,
        NzListModule,
        NzTableModule,
        NzInputModule,
        NzDropDownModule,
        NzCheckboxModule,
        NzMessageServiceModule,
        NzTimePickerModule,
        NzButtonModule,
        NzResultModule,
    ],
    exports: [
        VoiceMailComponent
    ],
    declarations: [
        VoiceMailComponent
    ]
})
export class VoiceMailsModule { }
