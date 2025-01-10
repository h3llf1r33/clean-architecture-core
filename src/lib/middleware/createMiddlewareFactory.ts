import { Observable, from, of } from 'rxjs';
import { mergeMap, takeUntil } from 'rxjs/operators';
import { HttpClientRequestOptions } from '../common/Http';


export function createHttpClientMiddlewareFactory(
    middlewares: Observable<HttpClientRequestOptions>[], 
    initialConfig: HttpClientRequestOptions
): Observable<HttpClientRequestOptions> {
  if (middlewares.length === 0) {
      return of(initialConfig);
  }

  return new Observable(subscriber => {
      const completion$ = new Observable(sub => {
          subscriber.add(() => sub.next());
      });

      const subscription = from(middlewares).pipe(
          mergeMap(middleware => middleware.pipe(
              takeUntil(completion$)
          ))
      ).subscribe({
          next: value => subscriber.next(value),
          error: err => subscriber.error(err),
          complete: () => subscriber.complete()
      });

      return () => {
          subscription.unsubscribe();
      };
  });
}