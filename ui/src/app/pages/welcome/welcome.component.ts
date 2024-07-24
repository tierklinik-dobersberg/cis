import { Component, effect, isDevMode, OnDestroy, OnInit } from '@angular/core';
import { injectCurrentProfile } from '@tierklinik-dobersberg/angular/behaviors';
import { DisplayNamePipe } from '@tierklinik-dobersberg/angular/pipes';
import { Subscription } from 'rxjs';
import { retry } from 'rxjs/operators';
import { VoiceMailAPI } from 'src/app/api';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { LayoutService } from 'src/app/services';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  mailboxes: string[] = [];
  
  protected readonly currentUser = injectCurrentProfile();

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
    private voicemailapi: VoiceMailAPI,
    public layout: LayoutService,
  ) {
    effect(() => {
      const profile = this.currentUser();
      const name = new DisplayNamePipe().transform(profile);

      this.header.set(`Hallo ${name},`, 'Hier findest du eine Übersicht der wichtigsten Informationen.');
    })
  }

  readonly isDevMode = isDevMode();

  private allSub = new Subscription();

  ngOnInit(): void {

    this.voicemailapi.listMailboxes()
      .pipe(retry({delay: 10000}))
      .subscribe(mailboxes => {
        this.mailboxes = mailboxes;
      });
  }

  ngOnDestroy(): void {
    this.allSub.unsubscribe();
  }
}
