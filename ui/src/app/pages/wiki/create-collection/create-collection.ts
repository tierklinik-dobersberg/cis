import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { WikiAPI } from "src/app/api/wiki.api";
import { extractErrorMessage } from "src/app/utils";
import { WikiHelper } from "../wiki-helper";

@Component({
  templateUrl: './create-collection.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiCreateCollectionComponent {
  name = '';
  description = '';

  constructor(
    private wiki: WikiAPI,
    private helper: WikiHelper,
    private nzMessageService: NzMessageService,
    private router: Router,
  ) {}

  createCollection() {
    this.wiki.collections.create({
      name: this.name,
      description: this.description,
    })
    .subscribe({
      next: () => {
        this.nzMessageService.success("Bereich " + this.name + " wurde erstellt.");
        this.helper.notifyCollectionChange();
        this.router.navigate(['/wiki/collection/', this.name])
      },
      error: err => this.nzMessageService.error(extractErrorMessage(err, 'Bereich konnte nicht erstellt werden'))
    })
  }
}
