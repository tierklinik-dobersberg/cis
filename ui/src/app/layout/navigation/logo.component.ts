import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
    selector: 'app-logo',
    standalone: true,
    imports: [RouterLink],
    template: `

    
    <a class="flex items-center space-x-2" routerLink="/welcome">
      <img src="assets/logo.png" class="h-10 w-10" alt="logo" />
      <h1 class="flex flex-col text-base font-semibold leading-4">
        <span style="color: #1080cf">Tierklinik</span>
        <span style="color: #15377e">Dobersberg</span>
      </h1>
    </a>
    
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLogo {}