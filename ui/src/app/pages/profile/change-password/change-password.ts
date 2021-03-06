import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { IdentityAPI, PasswordStrenght, ProfileWithAvatar } from 'src/app/api';
import { HeaderTitleService } from 'src/app/shared/header-title';

interface TranslatedStrength extends PasswordStrenght {
  text: string;
  color: string;
}

const ScoreTranslations = [
  'Sehr schlecht',
  'Schlecht',
  'Mäßig',
  'Gut',
  'Ausgezeichnet'
];

const ScoreColors = [
  '#DC2626',
  '#F87171',
  '#F59E0B',
  '#60A5FA',
  '#059669'
];

@Component({
  templateUrl: './change-password.html',
  styleUrls: ['./change-password.scss'],
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  validateForm!: FormGroup;

  profile: ProfileWithAvatar | null = null;
  strength: TranslatedStrength | null = null;

  currentPwd = '';
  newPwd = '';
  repeatPwd = '';

  private subscriptions = Subscription.EMPTY;
  private checkPassword = new Subject<string>();

  submitForm(): void {
    for (const i of Object.keys(this.validateForm.controls)) {
      this.validateForm.controls[i].markAsDirty();
      this.validateForm.controls[i].updateValueAndValidity();
    }

    if (!this.validateForm.valid) {
      return;
    }

    if (this.repeatPwd !== this.newPwd) {
      this.messageService.warning(`Passwörter stimmen nicht überein.`);
      return;
    }

    this.identityapi.changePassword(this.currentPwd, this.newPwd)
      .subscribe(
        () => this.router.navigate(['../']),
        err => {
          this.messageService.error(`Passwort konnte nicht geändert werden: ${err.statusText || err.error || err.message}`);
        }
      );
  }

  onPasswordChange(value: string): void {
    this.checkPassword.next(value);
  }

  constructor(
    private header: HeaderTitleService,
    private fb: FormBuilder,
    private identityapi: IdentityAPI,
    private router: Router,
    private messageService: NzMessageService) { }

  ngOnInit(): void {
    this.header.set('Passwort ändern.');
    this.validateForm = this.fb.group({
      currentPassword: [null, [Validators.required]],
      password: [null, [Validators.required]],
      passwordRepeat: [null, [Validators.required]],
    });

    this.subscriptions = new Subscription();
    const profileSub = this.identityapi.profileChange
      .subscribe(p => {
        this.profile = p;
      });
    this.subscriptions.add(profileSub);

    const changeSub = this.checkPassword
      .pipe(
        debounceTime(100),
        switchMap(p => this.identityapi.testPassword(p)),
        catchError(err => of(null))
      )
      .subscribe((result: PasswordStrenght | null) => {
        if (!result) {
          this.strength = null;
          return;
        }

        this.strength = {
          ...result,
          text: ScoreTranslations[result.score],
          color: ScoreColors[result.score],
        };
      });
    this.subscriptions.add(changeSub);

  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
