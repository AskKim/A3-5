/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: Lets a screen ask what this device can handle, without reaching into the phone-specific code itself.
 * PART 2 — FOR AI / DEVELOPERS:
 * Device capability detection capability port.
 *
 * The browser implementation stays in `src/storage/deviceCapabilityDetector`; the app layer owns that edge, so UI
 * components depend on this contract instead of importing a storage singleton directly. A host
 * shell or a test can substitute its own implementation at the composition layer without touching
 * the components.
 */
export * from '../../storage/deviceCapabilityDetector';
