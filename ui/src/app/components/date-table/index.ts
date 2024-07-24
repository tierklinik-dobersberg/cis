import { NgModule } from '@angular/core';
import { AppDateTableCellDirective } from './date-table-cell.directive';
import { AppDateTableComponent } from './date-table.component';
import { AppDateTableHighlightRange } from './highlight-range.directive';
import { AppDateTableRangeSelectDirective } from './range-select.directive';

export * from './date-table-cell.directive';
export * from './date-table.component';

export const AppDateTableModuleImports = [
    AppDateTableCellDirective,
    AppDateTableComponent,
    AppDateTableRangeSelectDirective,
    AppDateTableHighlightRange,
];

@NgModule({
    imports: AppDateTableModuleImports,
    exports: AppDateTableModuleImports,
})
export class AppDateTableModule {}