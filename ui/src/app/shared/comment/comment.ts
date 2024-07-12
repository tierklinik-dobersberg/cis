import { coerceBooleanProperty } from '@angular/cdk/coercion';
import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { DisplayNamePipe, ToDatePipe, ToUserPipe } from '@tierklinik-dobersberg/angular/pipes';
import { CommentTree } from '@tierklinik-dobersberg/apis';
import { NzMessageService } from 'ng-zorro-antd/message';
import { MarkdownModule } from 'ngx-markdown';
import { COMMENT_SERVICE } from 'src/app/api/connect_clients';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { extractErrorMessage } from 'src/app/utils';
import { TextInputComponent } from '../text-input';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.html',
  styleUrls: ['./comment.scss'],
  standalone: true,
  imports: [
    MarkdownModule,
    TextInputComponent,
    FormsModule,
    DatePipe,
    ToDatePipe,
    ToUserPipe,
    DisplayNamePipe,
    HlmButtonDirective,
    AppAvatarComponent,
  ]
})
export class CommentComponent implements OnInit {
  private readonly commentService = inject(COMMENT_SERVICE);

  protected readonly profiles = injectUserProfiles();

  @Input()
  comment: CommentTree;

  @Input()
  set rendered(v: any) {
    this._rendered = coerceBooleanProperty(v)
  }
  get rendered() { return this._rendered }
  private _rendered = false;

  @Input()
  nestedLimit = Infinity;

  @Input()
  nestedCount = 0;

  @Input()
  canReply: boolean | null = null;

  @Input()
  showReplies: boolean | null = null;

  @Output()
  replied = new EventEmitter<void>();

  commentText = '';
  reply = false;

  get safeContent() {
    return this.san.bypassSecurityTrustHtml(this.comment.comment.content)
  }

  constructor(
    private nzMessage: NzMessageService,
    private san: DomSanitizer,
  ) { }

  ngOnInit(): void {
    if (this.canReply === null) {
      this.canReply = true;
    }

    if (this.showReplies === null) {
      this.showReplies = true;
    }
  }

  toggleReply(): void {
    this.reply = !this.reply;
    this.commentText = '';
  }

  replyComment(): void {
    this.commentService.createComment({
      kind: {
        case: 'parentId',
        value: this.comment.comment.id,
      },
      content: this.commentText
    })
      .then(
        () => {
          this.replied.next();
          this.commentText = '';
          this.reply = false;
        }
      )
      .catch(
        err => this.nzMessage.error(extractErrorMessage(err, 'Kommentar konnte nicht erstellt werden'))
      )
  }
}
