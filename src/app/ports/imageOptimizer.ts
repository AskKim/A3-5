/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Image-optimization capability port.
 *
 * Six editors and panels compress uploads by calling `optimizeImageFile` /
 * `optimizeStagedImporterPhotos` straight out of `src/storage/webImageOptimizer`. That made every photo
 * surface depend on a storage module (and on a canvas/worker chain) it cannot be rendered without.
 * The port is a module-level injectable, like the diagnostics port, so a test can hand a surface a
 * fake optimiser without a canvas.
 */
import {
  optimizeImageFile,
  optimizeStagedImporterPhotos,
  type BatchImportPhotoProgress,
} from '../../storage/webImageOptimizer';

export type { BatchImportPhotoProgress };

/** Everything the photo surfaces need from the optimiser. */
export interface ImageOptimizerPort {
  optimizeImageFile: typeof optimizeImageFile;
  optimizeStagedImporterPhotos: typeof optimizeStagedImporterPhotos;
}

/** The browser implementation over the real canvas/worker optimiser. */
export const browserImageOptimizerPort: ImageOptimizerPort = {
  optimizeImageFile,
  optimizeStagedImporterPhotos,
};

let activePort: ImageOptimizerPort = browserImageOptimizerPort;

export function getImageOptimizerPort(): ImageOptimizerPort {
  return activePort;
}

/** Swaps the port (tests, alternate shells). Returns the previous port for easy restoration. */
export function setImageOptimizerPort(next: ImageOptimizerPort): ImageOptimizerPort {
  const previous = activePort;
  activePort = next;
  return previous;
}

export function resetImageOptimizerPort(): void {
  activePort = browserImageOptimizerPort;
}
