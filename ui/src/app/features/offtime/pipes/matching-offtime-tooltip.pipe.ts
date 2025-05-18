import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DisplayNamePipe } from '@tierklinik-dobersberg/angular/pipes';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import { OffTimeEntry } from '@tierklinik-dobersberg/apis/roster/v1';

@Pipe({
  name: 'matchingOfftimeTooltip',
  pure: true,
  standalone: true,
})
export class MatchingOfftimeTooltipPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(entries: OffTimeEntry[], profiles: Profile[]): SafeHtml {
    if (!entries?.length) {
      return '';
    }

    const models = entries.map(e => {
      let name = e.requestorId;

      const profile = profiles.find(p => p.user!.id === e.requestorId);
      if (profile) {
        name = new DisplayNamePipe().transform(profile);
      }

      return `<li>${name}: ${e.description}</li>`
    })

    return this.sanitizer.bypassSecurityTrustHtml(
      `<ul class="list-disc">
        ${models.join("\n")}
      </ul>`
    )
  }

}
