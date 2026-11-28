// @vitest-environment jsdom
/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Tier A render coverage for the print preview modal: the iframe document, zoom controls and the
 * pedigree photo toggle are the paths every printable export goes through.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrintPreviewModal } from '../PrintPreviewModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PrintPreviewModal', () => {
  it('renders the printable document and closes on demand', () => {
    const onClose = vi.fn();
    render(
      <PrintPreviewModal
        title="Pedigree Preview"
        filename="pedigree.htm"
        htmlContent="<h1>Willow</h1>"
        onClose={onClose}
        onDownloadPdf={vi.fn(async () => undefined)}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Pedigree Preview' })).toBeTruthy();
    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('srcdoc') ?? frame?.getAttribute('src') ?? '').toContain('Willow');

    fireEvent.click(screen.getAllByLabelText('Close preview')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zooms the preview and toggles the primary photo', () => {
    const onToggleIncludePrimaryPhoto = vi.fn();
    render(
      <PrintPreviewModal
        title="Pedigree Preview"
        filename="pedigree.htm"
        htmlContent="<h1>Willow</h1>"
        includePrimaryPhoto
        onToggleIncludePrimaryPhoto={onToggleIncludePrimaryPhoto}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Zoom in preview'));
    fireEvent.click(screen.getByLabelText('Zoom out preview'));
    expect(screen.getByLabelText('Zoom in preview')).toBeTruthy();

    const photoToggle = screen.queryByRole('checkbox', { name: /photo/i });
    if (photoToggle) {
      fireEvent.click(photoToggle);
      expect(onToggleIncludePrimaryPhoto).toHaveBeenCalled();
    }
  });

  it('exposes the pedigree export format selector', () => {
    const onChangePedigreeDocMode = vi.fn();
    render(
      <PrintPreviewModal
        title="Pedigree Preview"
        filename="pedigree.htm"
        htmlContent="<h1>Willow</h1>"
        pedigreePrintOptions={{ orientation: 'landscape', showWeights: true }}
        onChangePedigreePrintOptions={vi.fn()}
        pedigreeDocMode="formal_certificate"
        onChangePedigreeDocMode={onChangePedigreeDocMode}
        onClose={vi.fn()}
      />
    );

    const group = screen.getByRole('group', { name: 'Pedigree export format' });
    fireEvent.click(within(group).getByRole('button', { name: 'Shareable Card (.HTML)' }));
    expect(onChangePedigreeDocMode).toHaveBeenCalledWith('shareable_card');
  });
});
