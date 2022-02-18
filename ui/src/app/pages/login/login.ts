import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subscription } from 'rxjs';
import { IdentityAPI, Profile } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';

@Component({
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  lastMessageID = '';
  username = '';
  password = '';
  profile: Profile | null = null;

  validateForm!: FormGroup;

  submitForm(): void {
    for (const i of Object.keys(this.validateForm.controls)) {
      this.validateForm.controls[i].markAsDirty();
      this.validateForm.controls[i].updateValueAndValidity();
    }

    if (this.validateForm.valid) {
      if (this.lastMessageID !== '') {
        this.messageService.remove(this.lastMessageID);
      }

      this.lastMessageID = this.messageService.loading('Anmeldung ...').messageId;

      this.identityapi.login(this.username, this.password)
        .subscribe(
          () => {
            this.messageService.remove(this.lastMessageID);
            const target = this.activatedRoute.snapshot.queryParamMap.get('rd') || '/';

            if (target.startsWith('http')) {
              window.location.href = target;
            } else {
              this.router.navigate([target]);
            }
          },
          err => {
            this.messageService.remove(this.lastMessageID);
            const msg = extractErrorMessage(err, 'Anmeldung fehlgeschlagen');
            this.lastMessageID = this.messageService.error(msg).messageId;
          }
        );
    }
  }

  continue(): void {
    // try to refresh the access token
    this.identityapi.refresh()
      .subscribe(
        () => {
          const target = this.activatedRoute.snapshot.queryParamMap.get('rd') || '/';

          if (target.startsWith('http')) {
            window.location.href = target;
          } else {
            this.router.navigate([target]);
          }
        },
        err => {
          this.profile = null;
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.lastMessageID = this.messageService.error('Aus Sicherheitsgründen musst du dich erneut anmelden.').messageId;
          } else {
            this.messageService.error('Failed to refresh session access token');
            console.error(err);
          }
        }
      );
  }

  logout(): void {
    this.identityapi.logout()
      .subscribe(() => this.router.navigate(['/', 'login']));
  }

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private messageService: NzMessageService,
    private identityapi: IdentityAPI,
    private activatedRoute: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.validateForm = this.fb.group({
      userName: [null, [Validators.required]],
      password: [null, [Validators.required]],
      remember: [true]
    });

    this.subscriptions = new Subscription();

    const sub = this.identityapi.profileChange.subscribe(profile => this.profile = profile);
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
