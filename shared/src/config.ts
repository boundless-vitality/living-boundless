// One place for names and addresses that aren't final yet.
// The app name and URL scheme live in brand.json so the Expo config can read them too.
import brand from './brand.json';

/** Patient-facing app name. Not final: change it in brand.json. */
export const APP_NAME: string = brand.appName;

export const CLINIC_NAME = 'Boundless Vitality';

/** Provider name used in friendly copy ("check in with Cristie"). */
export const PROVIDER_NAME = 'Cristie';

/**
 * Where plan links point. This page only shows "open the app" instructions;
 * the plan itself rides in the #fragment and is never sent to the server.
 * TODO: replace with the real GitHub Pages address once the org/repo exist.
 */
export const PLAN_LINK_BASE = 'https://boundless-vitality.github.io/living-boundless/p/';

/** Custom URL scheme for the patient app (deep links). */
export const APP_SCHEME: string = brand.scheme;
