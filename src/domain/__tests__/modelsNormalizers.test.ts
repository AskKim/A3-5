import { describe, expect, it } from 'vitest';
import {
  buildEmptyShellSnapshot,
  extractBaseLanguageCode,
  formatBreedingStatusForSpecies,
  formatCurrencyCents,
  formatWeightInputValue,
  getWeightInputMeta,
  normalizeBcp47LanguageTag,
  normalizeClientKind,
  normalizeCurrencyCode,
  normalizeJudgeBidStatus,
  normalizeJudgeContractStatus,
  normalizeJudgeExpenseCategory,
  normalizeJournalStarRating,
  normalizeLedgerCategory,
  normalizeLedgerEntryType,
  normalizeMileageTripPurpose,
  normalizePeltGrade,
  normalizePreferredContactMethod,
  normalizeProcessingStatus,
  normalizeReservationStatus,
  normalizeRufusLevel,
  normalizeSpeciesHubBlockOrder,
  normalizeWaitlistIntent,
  normalizeWaitlistStatus,
  normalizeWoolHarvestMethod,
  normalizeYouthOrgType,
  normalizeYouthProjectFeedLogs,
} from '../models';

describe('BCP 47 language tags', () => {
  it.each([
    ['en_us', 'en-US'],
    ['EN', 'en'],
    ['zh-hant', 'zh-Hant'],
    ['ab-Latn-US', 'ab-Latn-US'],
    ['es-419', 'es-419'],
    ['en--US', 'en-US'],
    ['en_US_extra_more', 'en-US-extra-More'],
    ['  fr  ', 'fr'],
  ])('normalizes %j to %j', (raw, expected) => {
    expect(normalizeBcp47LanguageTag(raw)).toBe(expected);
  });

  it.each([[42], [null], [''], ['a-b'], ['ab-abcdefghi'], ['ab-c-d'], ['abcd']])(
    'rejects %j',
    (raw) => {
      expect(normalizeBcp47LanguageTag(raw)).toBe('');
    }
  );

  it('extracts the base language or empty for invalid tags', () => {
    expect(extractBaseLanguageCode('EN_us')).toBe('en');
    expect(extractBaseLanguageCode('not a tag')).toBe('');
  });
});

describe('currency helpers', () => {
  it('validates ISO codes with a fallback', () => {
    expect(normalizeCurrencyCode(' usd ')).toBe('USD');
    expect(normalizeCurrencyCode('US')).toBe('USD');
    expect(normalizeCurrencyCode('USDD')).toBe('USD');
    expect(normalizeCurrencyCode(undefined, 'EUR')).toBe('EUR');
    expect(normalizeCurrencyCode(null)).toBe('USD');
  });

  it('formats cents and clamps non-finite input', () => {
    expect(formatCurrencyCents(1234)).toBe('$12.34');
    expect(formatCurrencyCents(undefined)).toBe('$0.00');
    expect(formatCurrencyCents(Number.NaN)).toBe('$0.00');
    expect(formatCurrencyCents(-250)).toBe('-$2.50');
    expect(formatCurrencyCents(1000, 'eur')).toBe('€10.00');
  });
});

describe('rufus levels', () => {
  it.each([
    ['high', 'High'],
    ['High Rufus', 'High'],
    ['med', 'Medium'],
    ['medium rufus', 'Medium'],
    ['low', 'Low'],
    ['low rufus', 'Low'],
    ['unspecified', ''],
  ])('coerces %j', (raw, expected) => {
    expect(normalizeRufusLevel(raw)).toBe(expected);
  });

  it('ignores non-strings', () => {
    expect(normalizeRufusLevel(7)).toBe('');
  });
});

describe('normalizeSpeciesHubBlockOrder', () => {
  it('returns the default order when nothing is stored', () => {
    expect(normalizeSpeciesHubBlockOrder(undefined)).toEqual([
      'tasks',
      'breedings',
      'cages',
      'feed',
      'shows',
    ]);
    expect(normalizeSpeciesHubBlockOrder('tasks')).toEqual([
      'tasks',
      'breedings',
      'cages',
      'feed',
      'shows',
    ]);
  });

  it('keeps valid unique order and appends missing blocks', () => {
    expect(normalizeSpeciesHubBlockOrder(['feed', 'bogus', 'feed', 9, 'tasks'])).toEqual([
      'feed',
      'tasks',
      'breedings',
      'cages',
      'shows',
    ]);
  });
});

describe('ledger normalizers', () => {
  it.each([
    ['income', 'income'],
    ['Revenue', 'income'],
    ['sale', 'income'],
    ['cost', 'expense'],
    ['expense', 'expense'],
    ['unexpected', 'expense'],
  ])('coerces entry type %j', (raw, expected) => {
    expect(normalizeLedgerEntryType(raw)).toBe(expected);
  });

  it('honours entry-type fallbacks and non-strings', () => {
    expect(normalizeLedgerEntryType('nope', 'income')).toBe('income');
    expect(normalizeLedgerEntryType(undefined, 'income')).toBe('income');
  });

  it.each([
    ['feed', 'feed'],
    ['Feed & Hay', 'feed'],
    ['Bedding', 'bedding'],
    ['Vet Bill', 'vet'],
    ['Medication', 'vet'],
    ['New Hutch', 'equipment'],
    ['Cage repair', 'equipment'],
    ['Butcher fee', 'processing'],
    ['Show Fees', 'show_entry'],
    ['Supplements', 'supplies'],
    ['Pelt sale', 'meat_pelt_sale'],
    ['Stud service', 'stud_fee'],
    ['Fair Premium', 'grant_sponsor'],
    ['Doe Sale', 'animal_sale'],
    ['mystery', 'other'],
  ])('coerces ledger category %j', (raw, expected) => {
    expect(normalizeLedgerCategory(raw)).toBe(expected);
  });

  it('honours category fallbacks and non-strings', () => {
    expect(normalizeLedgerCategory('nope', 'vet')).toBe('vet');
    expect(normalizeLedgerCategory(12, 'supplies')).toBe('supplies');
  });
});

describe('processing and pelt normalizers', () => {
  it.each([
    ['scheduled', 'Scheduled'],
    ['Planned', 'Scheduled'],
    ['canceled', 'Cancelled'],
    ['cancelled', 'Cancelled'],
    ['harvested', 'Processed'],
    ['completed', 'Processed'],
    ['unknown', 'Processed'],
  ])('coerces processing status %j', (raw, expected) => {
    expect(normalizeProcessingStatus(raw)).toBe(expected);
  });

  it('honours processing fallbacks and non-strings', () => {
    expect(normalizeProcessingStatus('unknown', 'Scheduled')).toBe('Scheduled');
    expect(normalizeProcessingStatus(null, 'Cancelled')).toBe('Cancelled');
  });

  it.each([
    ['prime', 'Prime'],
    ['No. 1', 'No. 1'],
    ['no 1', 'No. 1'],
    ['1', 'No. 1'],
    ['grade 1', 'No. 1'],
    ['2', 'No. 2'],
    ['grade 3', 'No. 3'],
    ['cull', 'Cull'],
    ['none', 'Not Saved'],
    ['discarded', 'Not Saved'],
    ['mystery', ''],
  ])('coerces pelt grade %j', (raw, expected) => {
    expect(normalizePeltGrade(raw)).toBe(expected);
  });

  it('rejects non-string pelt grades', () => {
    expect(normalizePeltGrade(1)).toBe('');
  });
});

describe('youth project normalizers', () => {
  it.each([
    ['ffa', 'FFA'],
    ['4h', '4-H'],
    ['4-H', '4-H'],
    ['other', 'Other Youth'],
    ['unknown', '4-H'],
  ])('coerces youth org %j', (raw, expected) => {
    expect(normalizeYouthOrgType(raw)).toBe(expected);
  });

  it('honours youth-org fallbacks and non-strings', () => {
    expect(normalizeYouthOrgType('unknown', 'FFA')).toBe('FFA');
    expect(normalizeYouthOrgType(undefined, 'Other Youth')).toBe('Other Youth');
  });

  it('cleans, defaults, de-duplicates and sorts feed logs newest first', () => {
    const out = normalizeYouthProjectFeedLogs([
      {
        id: 'a',
        dateIso: ' 2026-01-02 ',
        feedType: ' Pellets ',
        quantity: '2.5',
        unit: ' oz ',
        costCents: '12.4',
        linkedFeedBatchId: ' b1 ',
        notes: ' note ',
      },
      { id: 'a', dateIso: '2026-02-01', feedType: 'Hay' },
      { feedType: '', quantity: 0, costCents: 0 },
      'not-an-entry',
      null,
    ]);

    expect(out.map((e) => e.id)).toEqual(['a-2', 'a']);
    expect(out[1]).toEqual({
      id: 'a',
      dateIso: '2026-01-02',
      feedType: 'Pellets',
      quantity: 2.5,
      unit: 'oz',
      costCents: 12,
      linkedFeedBatchId: 'b1',
      notes: 'note',
    });
  });

  it('clamps invalid numbers and falls back to derived ids and units', () => {
    const out = normalizeYouthProjectFeedLogs([
      { dateIso: '02/01/2026', quantity: -5, costCents: -3, feedType: 'Grain' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 'yfl-1',
      dateIso: '',
      feedType: 'Grain',
      quantity: 0,
      costCents: 0,
      unit: 'lbs',
    });
    expect(out[0].linkedFeedBatchId).toBeUndefined();
    expect(out[0].notes).toBeUndefined();
  });

  it('returns an empty list for non-arrays', () => {
    expect(normalizeYouthProjectFeedLogs('nope')).toEqual([]);
    expect(normalizeYouthProjectFeedLogs(undefined)).toEqual([]);
  });
});

describe('client normalizers', () => {
  it.each([
    ['email', 'email'],
    ['mail', 'email'],
    ['call', 'phone'],
    ['text', 'sms'],
    ['in person', 'in_person'],
    ['barn', 'in_person'],
    ['other', 'other'],
    ['unexpected', 'sms'],
  ])('coerces contact method %j', (raw, expected) => {
    expect(normalizePreferredContactMethod(raw)).toBe(expected);
  });

  it('honours contact fallbacks and non-strings', () => {
    expect(normalizePreferredContactMethod('unexpected', 'email')).toBe('email');
    expect(normalizePreferredContactMethod(null, 'phone')).toBe('phone');
  });

  it.each([
    ['show_breeder', 'show_breeder'],
    ['Show rabbit buyer', 'show_breeder'],
    ['breeding program', 'show_breeder'],
    ['4h family', 'youth_4h_ffa'],
    ['FFA', 'youth_4h_ffa'],
    ['youth', 'youth_4h_ffa'],
    ['commercial', 'commercial_meat'],
    ['homestead', 'commercial_meat'],
    ['meat buyer', 'commercial_meat'],
    ['rescue', 'rescue_partner'],
    ['partner barn', 'rescue_partner'],
    ['companion', 'pet_buyer'],
    ['pet home', 'pet_buyer'],
    ['nonsense', 'pet_buyer'],
  ])('coerces client kind %j', (raw, expected) => {
    expect(normalizeClientKind(raw)).toBe(expected);
  });

  it('honours client fallbacks and non-strings', () => {
    expect(normalizeClientKind('nonsense', 'other')).toBe('other');
    expect(normalizeClientKind(3, 'rescue_partner')).toBe('rescue_partner');
  });
});

describe('waitlist and reservation normalizers', () => {
  it.each([
    ['waiting', 'Active'],
    ['open', 'Active'],
    ['matched', 'Matched'],
    ['reserved', 'Deposited'],
    ['sold', 'Fulfilled'],
    ['hold', 'Paused'],
    ['canceled', 'Cancelled'],
    ['bogus', 'Active'],
  ])('coerces waitlist status %j', (raw, expected) => {
    expect(normalizeWaitlistStatus(raw)).toBe(expected);
  });

  it('honours waitlist-status fallbacks and non-strings', () => {
    expect(normalizeWaitlistStatus('bogus', 'Matched')).toBe('Matched');
    expect(normalizeWaitlistStatus(0, 'Paused')).toBe('Paused');
  });

  it.each([
    ['show', 'Show / Breeding'],
    ['breeding', 'Show / Breeding'],
    ['pet', 'Pet / Companion'],
    ['companion', 'Pet / Companion'],
    ['4-h', '4-H / FFA Youth'],
    ['ffa', '4-H / FFA Youth'],
    ['commercial', 'Meat / Commercial'],
    ['any', 'Any'],
    ['bogus', 'Show / Breeding'],
  ])('coerces waitlist intent %j', (raw, expected) => {
    expect(normalizeWaitlistIntent(raw)).toBe(expected);
  });

  it('honours waitlist-intent fallbacks and non-strings', () => {
    expect(normalizeWaitlistIntent('bogus', 'Any')).toBe('Any');
    expect(normalizeWaitlistIntent(null, 'Pet / Companion')).toBe('Pet / Companion');
  });

  it.each([
    ['hold', 'Inquiry Hold'],
    ['pending', 'Pending Deposit'],
    ['deposited', 'Deposit Paid'],
    ['paid', 'Paid in Full'],
    ['ready', 'Ready for Pickup'],
    ['completed', 'Picked Up / Completed'],
    ['sold', 'Picked Up / Completed'],
    ['canceled', 'Cancelled'],
    ['bogus', 'Pending Deposit'],
  ])('coerces reservation status %j', (raw, expected) => {
    expect(normalizeReservationStatus(raw)).toBe(expected);
  });

  it('honours reservation fallbacks and non-strings', () => {
    expect(normalizeReservationStatus('bogus', 'Cancelled')).toBe('Cancelled');
    expect(normalizeReservationStatus(undefined, 'Inquiry Hold')).toBe('Inquiry Hold');
  });
});

describe('wool and mileage normalizers', () => {
  it.each([
    ['clipped', 'Shear'],
    ['sheared', 'Shear'],
    ['plucked', 'Pluck'],
    ['brush', 'Brush / Comb'],
    ['combed', 'Brush / Comb'],
    ['other', 'Other'],
    ['unknown', 'Shear'],
  ])('coerces wool method %j', (raw, expected) => {
    expect(normalizeWoolHarvestMethod(raw)).toBe(expected);
  });

  it('honours wool fallbacks and non-strings', () => {
    expect(normalizeWoolHarvestMethod('unknown', 'Pluck')).toBe('Pluck');
    expect(normalizeWoolHarvestMethod(null, 'Other')).toBe('Other');
  });

  it.each([
    ['county fair', 'Show Travel'],
    ['convention', 'Show Travel'],
    ['hay run', 'Feed & Supply Run'],
    ['supplies', 'Feed & Supply Run'],
    ['vet visit', 'Veterinary'],
    ['clinic', 'Veterinary'],
    ['delivery', 'Delivery / Pickup'],
    ['transport', 'Delivery / Pickup'],
    ['stud service', 'Breeding Service'],
    ['barn repair', 'Barn Maintenance'],
    ['other', 'Other'],
    ['unknown', 'Show Travel'],
  ])('coerces mileage purpose %j', (raw, expected) => {
    expect(normalizeMileageTripPurpose(raw)).toBe(expected);
  });

  it('honours mileage fallbacks and non-strings', () => {
    expect(normalizeMileageTripPurpose('unknown', 'Veterinary')).toBe('Veterinary');
    expect(normalizeMileageTripPurpose({}, 'Other')).toBe('Other');
  });
});

describe('journal star rating', () => {
  it.each([
    [Number.NaN, 0],
    ['nope', 0],
    [-2, 0],
    [0, 0],
    [3.4, 3],
    [4.5, 5],
    [9, 5],
    ['2', 2],
  ])('clamps %j to %i', (raw, expected) => {
    expect(normalizeJournalStarRating(raw)).toBe(expected);
  });
});

describe('judge normalizers', () => {
  it.each([
    ['lead', 'Inquiry'],
    ['submitted', 'Bid Submitted'],
    ['confirmed', 'Bid Accepted'],
    ['signed', 'Contracted'],
    ['judged', 'Completed'],
    ['rejected', 'Declined'],
    ['canceled', 'Cancelled'],
    ['bogus', 'Bid Submitted'],
  ])('coerces judge bid %j', (raw, expected) => {
    expect(normalizeJudgeBidStatus(raw)).toBe(expected);
  });

  it('honours judge-bid fallbacks and non-strings', () => {
    expect(normalizeJudgeBidStatus('bogus', 'Inquiry')).toBe('Inquiry');
    expect(normalizeJudgeBidStatus(0, 'Declined')).toBe('Declined');
  });

  it.each([
    ['none', 'Not Sent'],
    ['draft', 'Draft'],
    ['sent', 'Sent to Club'],
    ['awaiting signature', 'Sent to Club'],
    ['executed', 'Signed by Both'],
    ['fulfilled', 'Completed'],
    ['void', 'Void'],
    ['canceled', 'Void'],
    ['bogus', 'Not Sent'],
  ])('coerces judge contract %j', (raw, expected) => {
    expect(normalizeJudgeContractStatus(raw)).toBe(expected);
  });

  it('honours judge-contract fallbacks and non-strings', () => {
    expect(normalizeJudgeContractStatus('bogus', 'Void')).toBe('Void');
    expect(normalizeJudgeContractStatus(undefined, 'Draft')).toBe('Draft');
  });

  it.each([
    ['airfare', 'Flight / Airfare'],
    ['motel', 'Lodging / Hotel'],
    ['per diem', 'Meals / Per Diem'],
    ['rental car', 'Rental Car / Fuel'],
    ['gas', 'Rental Car / Fuel'],
    ['parking', 'Tolls & Parking'],
    ['coat supplies', 'Supplies / Coat'],
    ['license fee', 'Sanction / License Fee'],
    ['dues', 'Sanction / License Fee'],
    ['other', 'Other'],
    ['bogus', 'Other'],
  ])('coerces judge expense %j', (raw, expected) => {
    expect(normalizeJudgeExpenseCategory(raw)).toBe(expected);
  });

  it('honours judge-expense fallbacks and non-strings', () => {
    expect(normalizeJudgeExpenseCategory('bogus', 'Tolls & Parking')).toBe('Tolls & Parking');
    expect(normalizeJudgeExpenseCategory(null, 'Meals / Per Diem')).toBe('Meals / Per Diem');
  });
});

describe('weight input helpers', () => {
  it('formats grams in the requested unit', () => {
    expect(formatWeightInputValue(0, 'grams')).toBe('');
    expect(formatWeightInputValue(-1, 'grams')).toBe('');
    expect(formatWeightInputValue(4650.4, 'grams')).toBe('4650');
    expect(formatWeightInputValue(1850, 'kg')).toBe('1.85');
    expect(formatWeightInputValue(453.59237, 'lbs')).toBe('1.00');
  });

  it('describes each unit', () => {
    expect(getWeightInputMeta('grams')).toEqual({
      unitLabel: 'grams',
      shortUnit: 'g',
      placeholder: 'e.g. 4650',
    });
    expect(getWeightInputMeta('kg').shortUnit).toBe('kg');
    expect(getWeightInputMeta('lbs')).toEqual({
      unitLabel: 'decimal lbs',
      shortUnit: 'lbs',
      placeholder: 'e.g. 10.25',
    });
  });
});

describe('formatBreedingStatusForSpecies', () => {
  it('passes non-Born statuses through untouched', () => {
    expect(formatBreedingStatusForSpecies('Bred')).toBe('Bred');
    expect(formatBreedingStatusForSpecies('Bred', { birthEventLabel: 'Kindling' } as never)).toBe(
      'Bred'
    );
  });

  it.each([
    ['Kindling', 'Kindled'],
    ['Kidding', 'Kidded'],
    ['Lambing', 'Lambed'],
    ['Farrowing', 'Farrowed'],
    ['Calving', 'Calved'],
    ['Unpacking', 'Unpacked'],
    ['Whelping', 'Whelped'],
    ['Queening', 'Queened'],
    ['Hatching', 'Born'],
  ])('maps a %s birth event to %s', (label, expected) => {
    expect(formatBreedingStatusForSpecies('Born', { birthEventLabel: label } as never)).toBe(
      expected
    );
  });

  it('falls back to Birth when the profile has no label', () => {
    expect(formatBreedingStatusForSpecies('Born')).toBe('Born');
    expect(formatBreedingStatusForSpecies('Born', { birthEventLabel: '' } as never)).toBe('Born');
  });
});

describe('buildEmptyShellSnapshot', () => {
  it('builds a complete empty snapshot with preset species profiles', () => {
    const snapshot = buildEmptyShellSnapshot();
    expect(snapshot.settings).toBeTruthy();
    expect(snapshot.animals).toEqual([]);
    expect(snapshot.speciesProfiles.length).toBeGreaterThan(0);
    expect(snapshot.speciesProfiles[0].sortOrder).toBe(0);
    expect(snapshot.speciesProfiles.at(-1)?.sortOrder).toBe(snapshot.speciesProfiles.length - 1);
    expect(snapshot.speciesProfiles[0].createdAt).toBe(snapshot.speciesProfiles[0].updatedAt);
  });
});
