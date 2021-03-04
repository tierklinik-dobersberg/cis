import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Comment, CommentAPI } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';

@Component({
  selector: 'app-comment',
  templateUrl: './comment.html',
  styleUrls: ['./comment.scss']
})
export class CommentComponent implements OnInit {
  @Input()
  comment: Comment;

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

  constructor(
    private commentapi: CommentAPI,
    private nzMessage: NzMessageService,
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
    this.commentapi.reply(this.comment._id, this.commentText)
      .subscribe(
        () => {
          this.replied.next();
          this.commentText = '';
          this.reply = false;
        },
        err => this.nzMessage.error(extractErrorMessage(err, 'Kommentar konnte nicht erstellt werden'))
      );
  }
}
