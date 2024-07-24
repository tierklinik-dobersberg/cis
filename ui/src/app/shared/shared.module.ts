import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { DisplayNamePipe, ToUserPipe, UserColorPipe, UserContrastColorPipe } from '@tierklinik-dobersberg/angular/pipes';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTimePickerModule } from 'ng-zorro-antd/time-picker';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { MarkdownModule } from 'ngx-markdown';
import { TimeagoModule } from 'ngx-timeago';
import { HeaderTitleOutletComponent } from '../layout/header-title';
import { LinkNoBubbleDirective } from './a-no-bubble.directive';
import { CommentComponent } from './comment';
import { TkdDateInputModule } from './date-input';
import { TkdDebounceEventDirective } from './debounce-event.directive';
import { ListActionButtonGroupComponent } from './list-btn-group';
import { TkdOptionListInputComponent } from './option-list-input';
import { TkdOptionSpecInputComponent } from './option-spec-input';
import { ColorShadePipe, DurationPipe, FilterPipe, ToDatePipe, ToRGBAPipe } from './pipes';
import { CanDeleteCustomerPipe } from './pipes/can-delete-customer';
import { InListPipe } from './pipes/in-list.pipe';
import { TkdStringSliceInputComponent } from './simple-string-slice-input';
import { TextInputComponent } from './text-input';
import { UserAvatarComponent } from './user-avatar';

@NgModule({
  imports: [
    NzTableModule,
    NzToolTipModule,
    NzIconModule,
    NzAvatarModule,
    NzMessageModule,
    NzButtonModule,
    NzInputModule,
    NzCheckboxModule,
    NzSelectModule,
    MarkdownModule.forChild(),
    CommonModule,
    FormsModule,
    RouterModule,
    CKEditorModule,
    TimeagoModule,
    TkdDateInputModule,
    FilterPipe,
    ToRGBAPipe,
    ColorShadePipe,
    HeaderTitleOutletComponent,
    CommentComponent,
    TextInputComponent,
    TkdDebounceEventDirective,
    ToUserPipe,
    DisplayNamePipe,
    UserColorPipe,
    UserContrastColorPipe
  ],
  declarations: [
    DurationPipe,
    CanDeleteCustomerPipe,
    LinkNoBubbleDirective,
    TkdStringSliceInputComponent,
    TkdOptionSpecInputComponent,
    TkdOptionListInputComponent,
    ListActionButtonGroupComponent,
    UserAvatarComponent,
    ToDatePipe,
    InListPipe,
  ],
  exports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NzTableModule,
    NzToolTipModule,
    NzIconModule,
    NzAvatarModule,
    NzMessageModule,
    NzButtonModule,
    NzInputModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzTimePickerModule,
    NzEmptyModule,
    NzSelectModule,
    ScrollingModule,
    NzModalModule,
    DurationPipe,
    CommentComponent,
    TextInputComponent,
    CanDeleteCustomerPipe,
    LinkNoBubbleDirective,
    TkdStringSliceInputComponent,
    TkdOptionSpecInputComponent,
    TkdOptionListInputComponent,
    ListActionButtonGroupComponent,
    UserAvatarComponent,
    TimeagoModule,
    TkdDebounceEventDirective,
    ToDatePipe,
    CKEditorModule,
    InListPipe,
    TkdDateInputModule,
    FilterPipe,
    ToRGBAPipe,
    ColorShadePipe,
    HeaderTitleOutletComponent,
    ToUserPipe,
    DisplayNamePipe,
    UserColorPipe,
    UserContrastColorPipe
  ],
})
export class SharedModule { }
