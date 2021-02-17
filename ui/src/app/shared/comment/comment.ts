import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Comment, CommentAPI } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.html',
  styleUrls: ['./comment.scss']
})
export class CommentComponent {
  @Input()
  comment: Comment;

  @Input()
  nestedLimit = Infinity;

  @Input()
  nestedCount = 0;

  @Output()
  replied = new EventEmitter<void>();

  commentText: string = '';
  reply = false;

  constructor(
    private commentapi: CommentAPI,
    private nzMessage: NzMessageService,
  ) { }

  toggleReply() {
    this.reply = !this.reply;
    this.commentText = '';
  }

  replyComment() {
    this.commentapi.reply(this.comment._id, this.commentText)
      .subscribe(
        () => {
          this.replied.next()
          this.commentText = "";
          this.reply = false;
        },
        err => this.nzMessage.error(extractErrorMessage(err, "Kommentar konnte nicht erstellt werden"))
      )
  }
}
