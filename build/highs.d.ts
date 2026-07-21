/**
 * Handwritten declarations for the emscripten glue produced by build.sh,
 * which emits plain JavaScript. Kept next to highs.js so the static import
 * in src/module.ts typechecks without enabling allowJs project-wide.
 */
import type { HiGHSModuleFactory } from '../src/types.js';

declare const createHiGHSModule: HiGHSModuleFactory;
export default createHiGHSModule;
