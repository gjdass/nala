/** Replaced at build time (`define` in angular.json, overridden by the Docker build). */
declare const NALA_COMMIT: string;

/** Short hash of the commit the app was built from; `dev` outside a Docker build. */
export const COMMIT: string = NALA_COMMIT;
