/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The list of import formats, so a new source can be added without touching the screens.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Central External Platform Importer Registry (`src/domain/importers/registry.ts`).
 *
 * Designed so every additional livestock/pedigree platform we add (Evans Software, Kintracs,
 * Hutch, Livestocked, CattleMax, etc.) registers cleanly in one array with zero UI rewrite.
 */

import { createGenericImporterRegistry } from '@engine/primitives/genericRegistries';
import { HerdBossImporter } from './herdBossImporter';
import { PlatformImporter } from './importerTypes';
import { UniversalPedigreeImporter } from './universalPedigreeImporter';

export const PLATFORM_IMPORTERS: PlatformImporter[] = [
  HerdBossImporter,
  UniversalPedigreeImporter,
];

const DEFAULT_IMPORTER_REGISTRY = createGenericImporterRegistry(PLATFORM_IMPORTERS);

export function getPlatformImporterById(id: string): PlatformImporter {
  return DEFAULT_IMPORTER_REGISTRY.getById(id);
}
