import image from '@/generated/atlases/standin.png?url&no-inline';
import frames from '@/generated/atlases/standin.json?url&no-inline';

/**
 * The stand-in "Game-sized" art set (ADR-0011): one atlas page whose frames together cover more
 * than the design frame, keyed `standin/…` the way a Game's are. It stands in for a Game's art
 * until one exists. Imported here, so the bundler puts it in the build under content-hashed names.
 */
export const STANDIN_ATLAS = { image, frames } as const;
