import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { prefersReducedMotion } from './ui/media-query';
import { engineRequests } from './ui/engine-loading';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([engineRequests])),
    provideRouter(
      routes,
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          if (
            prefersReducedMotion() ||
            [from, to].some((state) => state.firstChild?.routeConfig?.path === 'admin')
          ) {
            transition.skipTransition();
          }
        },
      }),
    ),
  ],
};
