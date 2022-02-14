import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { HeaderTitleService } from "src/app/shared/header-title";

@Component({
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent implements OnInit {
  constructor(private headerTitleService: HeaderTitleService) {}

  ngOnInit() {
    this.headerTitleService.set("Administration", "Willkommen in der System-Administration.")
  }
}
