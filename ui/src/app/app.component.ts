import { Component, isDevMode, OnInit } from '@angular/core';
import { mergeMap } from 'rxjs/operators';
import { IdentityAPI } from './api';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  isCollapsed = false;
  isDevMode = isDevMode();

  userAvatar: string = '';

  constructor(private identity: IdentityAPI) { }

  ngOnInit() {
    this.identity.profile()
      .pipe(
        mergeMap(profile => this.identity.avatar(profile.name))
      )
      .subscribe(
        icon => this.userAvatar = icon,
        err => console.error(err),
      )
  }
}
