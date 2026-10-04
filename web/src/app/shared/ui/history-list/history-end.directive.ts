import { Directive } from '@angular/core';

/**
 * Marks the template a history list renders after its last page (e.g. Growth's Birth item); with it,
 * the list shows no empty state.
 */
@Directive({ selector: 'ng-template[nalaHistoryEnd]' })
export class HistoryEndDirective {}
