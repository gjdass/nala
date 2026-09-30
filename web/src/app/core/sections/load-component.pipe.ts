import { Pipe, PipeTransform, Type } from '@angular/core';
import { Observable, from } from 'rxjs';
import { ComponentLoader } from './section.models';

/**
 * Loads a registered section component on demand, for `ngComponentOutlet`:
 * `*ngComponentOutlet="(section.loadCard | nalaLoadComponent | async) ?? null"`. Pure, so each loader
 * runs once while it stays the same.
 */
@Pipe({ name: 'nalaLoadComponent' })
export class LoadComponentPipe implements PipeTransform {
  transform(loader: ComponentLoader): Observable<Type<unknown>> {
    return from(loader());
  }
}
