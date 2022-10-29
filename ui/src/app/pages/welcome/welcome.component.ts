import { Component, isDevMode, OnDestroy, OnInit } from '@angular/core';
import { TkdAccountService, Permissions } from '@tkd/api';
import { Subscription } from 'rxjs';
import { delay, retryWhen } from 'rxjs/operators';
import { VoiceMailAPI } from 'src/app/api';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  mailboxes: string[] = [];

  get hasDoorAccess(): boolean {
    return this.account.hasPermission(Permissions.DoorGet);
  }

  get hasDoctorOnDutyAccess(): boolean {
    return this.account.hasPermission(Permissions.ExternalReadOnDuty);
  }

  get hasRosterAccess(): boolean {
    return this.account.hasPermission(Permissions.RosterRead);
  }

  get hasTriggerAccess(): boolean {
    return this.account.hasPermission(Permissions.TriggerRead)
  }

  get hasSuggestionAccess(): boolean {
    return this.account.hasPermission(Permissions.SuggestionRead);
  }

  constructor(
    private header: HeaderTitleService,
    private account: TkdAccountService,
    private voicemailapi: VoiceMailAPI,
    public layout: LayoutService,
  ) { }

  readonly isDevMode = isDevMode();

  private allSub = new Subscription();

  ngOnInit(): void {
    const name = this.account.currentProfile?.fullname || this.account.currentProfile?.name;

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
