import { Pipe, PipeTransform } from "@angular/core";
import { Patient } from "@tierklinik-dobersberg/apis/customer/v1";

@Pipe({
  standalone: true,
  pure: true,
  name: 'patientIcon',
})
export class PatientIconPipe implements PipeTransform {
  transform(value: Patient) {
    if (!value.species) {
      return '\uD83D\uDC3E';
    }

    const val = value.species.toLocaleLowerCase();

    if (val.includes('hund')) {
      return '\uD83D\uDC15';
    }

    if (
      val.includes('huhn') ||
      val.includes('hühner') ||
      val.includes('hahn')
    ) {
      return '\uD83D\uDC14';
    }

    if (val.includes('pferd')) {
      return '\uD83D\uDC0E';
    }

    if (val.includes('schlange')) {
      return '\uD83D\uDC0D';
    }

    if (val.includes('katze') || val.includes('ktz')) {
      return '\uD83D\uDC08';
    }

    if (
      val.includes('hase') ||
      val.includes('kaninchen') ||
      val.includes('kanninchen')
    ) {
      return '\uD83D\uDC07';
    }

    if (val.includes('hamster')) {
      return '\uD83D\uDC39';
    }

    if (val.includes('maus')) {
      return '\uD83D\uDC01';
    }

    if (val.includes('ratte')) {
      return '\uD83D\uDC00';
    }

    if (val.includes('schildkröte')) {
      return '\uD83D\uDC22';
    }

    if (val.includes('vogel')) {
      return '\uD83D\uDC26';
    }

    if (val.includes('schweinchen')) {
      return '\uD83D\uDC37';
    }

    if (val.includes('schwein') || val.includes('pig')) {
      return '\uD83D\uDC16';
    }

    if (val.includes('reh')) {
      return '\uD83E\uDD8C';
    }

    if (val.includes('ente')) {
      return '\uD83E\uDD86';
    }

    if (val.includes('igel')) {
      return '\uD83E\uDD94';
    }

    return '\uD83D\uDC3E';
  }
}