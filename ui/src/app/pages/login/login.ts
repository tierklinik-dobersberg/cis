import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormGroup, FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { Subscription } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { IdentityAPI, Profile } from "src/app/api";

@Component({
    templateUrl: './login.html',
    styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;

    lastMessageID: string = '';
    username: string = '';
    password: string = '';
    profile: Profile | null = null;

    validateForm!: FormGroup;

    submitForm(): void {
        for (const i in this.validateForm.controls) {
            this.validateForm.controls[i].markAsDirty();
            this.validateForm.controls[i].updateValueAndValidity();
        }

        if (this.validateForm.valid) {
            if (this.lastMessageID != '') {
                this.messageService.remove(this.lastMessageID);
            }

            this.lastMessageID = this.messageService.loading('Anmeldung ...').messageId;

            this.identityapi.login(this.username, this.password)
                .pipe(mergeMap(() => this.identityapi.profile()))
                .subscribe(
                    profile => {
                        this.messageService.remove(this.lastMessageID);
                        this.lastMessageID = this.messageService.info(`Hallo, ${profile.fullname}`).messageId;
                        let target = this.activatedRoute.snapshot.queryParamMap.get('rd') || '/'

                        if (target.startsWith("http")) {
                            window.location.href = target;
                        } else {
                            this.router.navigate([target]);
                        }
                    },
                    err => {
                        this.messageService.remove(this.lastMessageID);

                        let msg = "";

                        if (typeof err == 'string') {
                            msg = err
                        } else if ('error' in err && typeof err.error === 'string') {
                            msg = err.error
                        } else if ('statusText' in err && typeof err.statusText === 'string') {
                            msg = err.statusText;
                        } else if ('message' in err && typeof err.message === 'string') {
                            msg = err.message;
                        }

                        if (msg !== "") {
                            msg = ': ' + msg
                        }

                        this.lastMessageID = this.messageService.error("Anmeldung fehlgeschlagen" + msg).messageId;
                    }
                )
        }
    }

    continue() {
        let target = this.activatedRoute.snapshot.queryParamMap.get('rd') || '/'

        if (target.startsWith("http")) {
            window.location.href = target;
        } else {
            this.router.navigate([target]);
        }
    }

    logout() {
        this.identityapi.logout()
            .subscribe(() => this.router.navigate(['/', 'login']))
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

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}