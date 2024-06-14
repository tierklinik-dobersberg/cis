import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { RouterModule } from '@angular/router';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
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
import { LinkNoBubbleDirective } from './a-no-bubble.directive';
import { CallLogTableComponent } from './callog-table';
import { CommentComponent } from './comment';
import { TkdDebounceEventDirective } from './debounce-event.directive';
import { HeaderTitleOutletComponent } from './header-title';
import { ListActionButtonGroupComponent } from './list-btn-group';
import { TkdOptionListInputComponent } from './option-list-input';
import { TkdOptionSpecInputComponent } from './option-spec-input';
import { ColorShadePipe, DurationPipe, FilterPipe, ToDatePipe, ToRGBAPipe, ToUserPipe, UserColorPipe, UserContrastColorPipe, UserNamePipe } from './pipes';
import { CanDeleteCustomerPipe } from './pipes/can-delete-customer';
import { TkdStringSliceInputComponent } from './simple-string-slice-input';
import { TextInputComponent } from './text-input';
import { UserAvatarComponent } from './user-avatar';
import { InListPipe } from './pipes/in-list.pipe';
import { TkdDateInputModule } from './date-input';

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
    ColorShadePipe
  ],
  declarations: [
    DurationPipe,
    HeaderTitleOutletComponent,
    CallLogTableComponent,
    CommentComponent,
    TextInputComponent,
    CanDeleteCustomerPipe,
    LinkNoBubbleDirective,
    TkdStringSliceInputComponent,
    TkdOptionSpecInputComponent,
    TkdOptionListInputComponent,
    ListActionButtonGroupComponent,
    TkdDebounceEventDirective,
    UserAvatarComponent,
    ToUserPipe,
    UserNamePipe,
    UserColorPipe,
    UserContrastColorPipe,
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
    HeaderTitleOutletComponent,
    CommentComponent,
    CallLogTableComponent,
    TextInputComponent,
    CanDeleteCustomerPipe,
    LinkNoBubbleDirective,
    MatBottomSheetModule,
    TkdStringSliceInputComponent,
    TkdOptionSpecInputComponent,
    TkdOptionListInputComponent,
    ListActionButtonGroupComponent,
    UserAvatarComponent,
    TimeagoModule,
    ToUserPipe,
    TkdDebounceEventDirective,
    UserNamePipe,
    UserColorPipe,
    UserContrastColorPipe,
    ToDatePipe,
    CKEditorModule,
    InListPipe,
    TkdDateInputModule,
    FilterPipe,
    ToRGBAPipe,
    ColorShadePipe
  ],
})
export class SharedModule { }
