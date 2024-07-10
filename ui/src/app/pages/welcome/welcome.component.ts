import { Component, isDevMode, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { delay, retryWhen } from 'rxjs/operators';
import { VoiceMailAPI } from 'src/app/api';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { LayoutService } from 'src/app/services';
import { ProfileService } from 'src/app/services/profile.service';
import { UserNamePipe } from 'src/app/shared/pipes';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  mailboxes: string[] = [];

  get hasDoorAccess(): boolean {
    return true;
  }

  get hasDoctorOnDutyAccess(): boolean {
    return true;
  }

  get hasRosterAccess(): boolean {
    return true;
  }

  constructor(
    private header: HeaderTitleService,
    private account: ProfileService,
    private voicemailapi: VoiceMailAPI,
    public layout: LayoutService,
  ) {}

  readonly isDevMode = isDevMode();

  private allSub = new Subscription();

  ngOnInit(): void {
    const name = UserNamePipe.transform(this.account.snapshot);

    this.header.set(`Hallo ${name},`, 'Hier findest du eine Übersicht der wichtigsten Informationen.');

    this.voicemailapi.listMailboxes()
      .pipe(retryWhen(e => e.pipe(delay(10000))))
      .subscribe(mailboxes => {
        this.mailboxes = mailboxes;
      });
  }

  ngOnDestroy(): void {
    this.allSub.unsubscribe();
  }
}
