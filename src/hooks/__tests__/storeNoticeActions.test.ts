/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createLocateConflictsInHerd,
  createStoreNoticeActions,
} from '../barnStore/storeNoticeActions';

describe('createStoreNoticeActions', () => {
  it('clears each banner through the store setter it was given', () => {
    const setStatusMessage = vi.fn();
    const setErrorMessage = vi.fn();
    const setImportConflictAlert = vi.fn();
    const actions = createStoreNoticeActions({
      setStatusMessage,
      setErrorMessage,
      setImportConflictAlert,
    });

    actions.clearStatusMessage();
    actions.clearErrorMessage();
    actions.dismissImportConflictAlert();

    expect(setStatusMessage).toHaveBeenCalledWith(null);
    expect(setErrorMessage).toHaveBeenCalledWith(null);
    expect(setImportConflictAlert).toHaveBeenCalledWith(null);
  });
});

describe('createLocateConflictsInHerd', () => {
  it('switches species, clears the selection and asks for the herd conflict view', () => {
    const deps = {
      setActiveSpeciesName: vi.fn(),
      clearSelectedAnimal: vi.fn(),
      requestHerdConflictView: vi.fn(),
      navigateToHerd: vi.fn(),
    };

    createLocateConflictsInHerd(deps)('Goat');

    expect(deps.setActiveSpeciesName).toHaveBeenCalledWith('Goat');
    expect(deps.clearSelectedAnimal).toHaveBeenCalledTimes(1);
    expect(deps.requestHerdConflictView).toHaveBeenCalledTimes(1);
    expect(deps.navigateToHerd).toHaveBeenCalledTimes(1);
  });

  it('keeps the current species when no name is supplied', () => {
    const deps = {
      setActiveSpeciesName: vi.fn(),
      clearSelectedAnimal: vi.fn(),
      requestHerdConflictView: vi.fn(),
      navigateToHerd: vi.fn(),
    };

    createLocateConflictsInHerd(deps)();

    expect(deps.setActiveSpeciesName).not.toHaveBeenCalled();
    expect(deps.navigateToHerd).toHaveBeenCalledTimes(1);
  });
});
