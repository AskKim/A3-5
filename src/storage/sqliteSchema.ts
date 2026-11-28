/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * PART 1 — FOR HUMANS: The database table definitions, shared with the native phone versions of the app.
 * PART 2 — FOR AI / DEVELOPERS:
 *
 * Canonical SQLite Schema DDL (`src/storage/sqliteSchema.ts`).
 *
 * Shared 1:1 with native `expo-sqlite` / Apple `WKWebView` / Android SQLite adapters.
 */

export const PEDIGREE_SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS barn_settings (
    id TEXT PRIMARY KEY NOT NULL,
    barn_name TEXT NOT NULL,
    breeder_name TEXT NOT NULL,
    preferred_unit TEXT NOT NULL,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    default_species TEXT NOT NULL,
    pinned_landing_species TEXT NOT NULL,
    default_generations INTEGER NOT NULL,
    theme_mode TEXT NOT NULL,
    custom_colors_json TEXT NOT NULL DEFAULT '{}',
    image_optimization_preset TEXT NOT NULL DEFAULT 'balanced',
    extra_settings_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS species_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    default_animal_prefix TEXT NOT NULL DEFAULT '',
    preferred_unit TEXT NOT NULL DEFAULT '',
    memo_text TEXT NOT NULL DEFAULT '',
    memo_updated_at TEXT NOT NULL DEFAULT '',
    gestation_days INTEGER NOT NULL,
    rebreed_days_after_birth INTEGER NOT NULL,
    wean_days_after_birth INTEGER NOT NULL,
    maturity_days INTEGER NOT NULL DEFAULT 0,
    birth_event_label TEXT NOT NULL,
    male_label TEXT NOT NULL,
    female_label TEXT NOT NULL,
    offspring_label TEXT NOT NULL,
    example_breeds_json TEXT NOT NULL,
    milestones_json TEXT NOT NULL,
    breed_overrides_json TEXT NOT NULL DEFAULT '[]',
    target_weight_curve_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS animals (
    id TEXT PRIMARY KEY NOT NULL,
    tattoo TEXT NOT NULL,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    breed TEXT NOT NULL,
    variety TEXT NOT NULL,
    sex TEXT NOT NULL,
    status TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    needs_attention INTEGER NOT NULL DEFAULT 0,
    ignored_conflicts_json TEXT NOT NULL DEFAULT '[]',
    birth_date_iso TEXT NOT NULL,
    weight_grams INTEGER NOT NULL,
    genotype_json TEXT NOT NULL,
    genotype_raw TEXT NOT NULL,
    rufus_level TEXT NOT NULL DEFAULT '',
    suspected_carrier_of_json TEXT NOT NULL DEFAULT '[]',
    confirmed_carrier_of_json TEXT NOT NULL DEFAULT '[]',
    cleared_carrier_of_json TEXT NOT NULL DEFAULT '[]',
    registration_number TEXT NOT NULL,
    grand_champion_number TEXT NOT NULL,
    legs_count INTEGER NOT NULL,
    cage_location TEXT NOT NULL,
    breeder_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    ownership_type TEXT NOT NULL DEFAULT 'Owned',
    culled INTEGER NOT NULL DEFAULT 0,
    cull_date_iso TEXT NOT NULL DEFAULT '',
    cull_reason TEXT NOT NULL DEFAULT '',
    deceased_date_iso TEXT NOT NULL DEFAULT '',
    death_cause TEXT NOT NULL DEFAULT '',
    sold_date_iso TEXT NOT NULL DEFAULT '',
    sale_price_cents INTEGER NOT NULL DEFAULT 0,
    purchase_cost_cents INTEGER NOT NULL DEFAULT 0,
    buyer_name TEXT NOT NULL DEFAULT '',
    for_sale INTEGER NOT NULL DEFAULT 0,
    asking_price_cents INTEGER NOT NULL DEFAULT 0,
    sale_notes TEXT NOT NULL DEFAULT '',
    sire_id TEXT NOT NULL,
    dam_id TEXT NOT NULL,
    notes TEXT NOT NULL,
    offloaded_archive_key TEXT NOT NULL DEFAULT '',
    offloaded_at_iso TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS animal_photos (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    animal_id TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    caption TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    original_bytes INTEGER NOT NULL,
    stored_bytes INTEGER NOT NULL,
    thumbnail_data_url TEXT NOT NULL,
    data_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_animal_photos_animal_id ON animal_photos(animal_id);

  CREATE TABLE IF NOT EXISTS cages (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    label TEXT NOT NULL,
    section TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    notes TEXT NOT NULL,
    unit_type TEXT NOT NULL DEFAULT '',
    feed_lot_name TEXT NOT NULL DEFAULT '',
    feed_stock_remaining REAL NOT NULL DEFAULT 0,
    feed_stock_unit TEXT NOT NULL DEFAULT '',
    daily_ration_note TEXT NOT NULL DEFAULT '',
    feed_low_threshold REAL NOT NULL DEFAULT 0,
    maintenance_interval_days INTEGER NOT NULL DEFAULT 0,
    maintenance_task_label TEXT NOT NULL DEFAULT '',
    last_maintenance_date_iso TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS breedings (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    sire_id TEXT NOT NULL,
    dam_id TEXT NOT NULL,
    sire_name TEXT NOT NULL,
    dam_name TEXT NOT NULL,
    bred_date_iso TEXT NOT NULL,
    expected_due_date_iso TEXT NOT NULL,
    actual_birth_date_iso TEXT NOT NULL,
    projected_coi_percent REAL NOT NULL,
    live_count INTEGER NOT NULL,
    stillborn_count INTEGER NOT NULL,
    fostered_count INTEGER NOT NULL,
    weaned_count INTEGER NOT NULL,
    offspring_created INTEGER NOT NULL,
    status TEXT NOT NULL,
    service_fee_cents INTEGER NOT NULL DEFAULT 0,
    service_fee_direction TEXT NOT NULL DEFAULT 'none',
    ultrasound_date_iso TEXT NOT NULL DEFAULT '',
    ultrasound_result TEXT NOT NULL DEFAULT '',
    ultrasound_fetal_count INTEGER NOT NULL DEFAULT 0,
    ultrasound_projected_due_iso TEXT NOT NULL DEFAULT '',
    litter_weight_milestones_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS barn_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    start_date_iso TEXT NOT NULL DEFAULT '',
    due_date_iso TEXT NOT NULL,
    linked_animal_id TEXT NOT NULL,
    linked_animal_name TEXT NOT NULL,
    linked_breeding_id TEXT NOT NULL,
    completed INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS care_logs (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    animal_id TEXT NOT NULL,
    date_iso TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    weight_grams INTEGER NOT NULL,
    show_leg_earned INTEGER NOT NULL,
    medication_name TEXT NOT NULL DEFAULT '',
    dosage TEXT NOT NULL DEFAULT '',
    administration_route TEXT NOT NULL DEFAULT '',
    withdrawal_days INTEGER NOT NULL DEFAULT 0,
    withdrawal_clear_date_iso TEXT NOT NULL DEFAULT '',
    body_condition_score REAL NOT NULL DEFAULT 0,
    famacha_score INTEGER NOT NULL DEFAULT 0,
    fecal_egg_count INTEGER NOT NULL DEFAULT 0,
    ultrasound_result TEXT NOT NULL DEFAULT '',
    ultrasound_fetal_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shows (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    sanctioning_body TEXT NOT NULL,
    event_date_iso TEXT NOT NULL,
    entry_deadline_iso TEXT NOT NULL,
    entered_animal_ids_json TEXT NOT NULL,
    results_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_batches (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL,
    lot_number TEXT NOT NULL DEFAULT '',
    mill_code TEXT NOT NULL DEFAULT '',
    manufacture_date_iso TEXT NOT NULL DEFAULT '',
    purchase_date_iso TEXT NOT NULL,
    bag_count REAL NOT NULL DEFAULT 0,
    bag_weight_value REAL NOT NULL DEFAULT 0,
    bag_weight_unit TEXT NOT NULL DEFAULT 'lbs',
    total_quantity REAL NOT NULL DEFAULT 0,
    remaining_quantity REAL NOT NULL DEFAULT 0,
    low_stock_threshold REAL NOT NULL DEFAULT 0,
    total_cost_cents INTEGER NOT NULL DEFAULT 0,
    supplier_name TEXT NOT NULL DEFAULT '',
    protein_percent REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    tag_photo_data_url TEXT NOT NULL DEFAULT '',
    tag_photo_thumbnail_data_url TEXT NOT NULL DEFAULT '',
    tag_photo_mime_type TEXT NOT NULL DEFAULT '',
    tag_photo_bytes INTEGER NOT NULL DEFAULT 0,
    tag_photo_captured_date_iso TEXT NOT NULL DEFAULT '',
    tag_photo_purged_at_iso TEXT NOT NULL DEFAULT '',
    tag_photo_bytes_reclaimed INTEGER NOT NULL DEFAULT 0,
    ocr_raw_text TEXT NOT NULL DEFAULT '',
    ocr_confidence REAL NOT NULL DEFAULT 0,
    ocr_manual_override INTEGER NOT NULL DEFAULT 0,
    recall_flagged INTEGER NOT NULL DEFAULT 0,
    recall_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feed_batches_species ON feed_batches(species);
  CREATE INDEX IF NOT EXISTS idx_feed_batches_lot ON feed_batches(lot_number);

  CREATE TABLE IF NOT EXISTS feed_allocations (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    feed_batch_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL DEFAULT '',
    target_label TEXT NOT NULL DEFAULT '',
    date_iso TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'lbs',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_feed_allocations_batch ON feed_allocations(feed_batch_id);

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    date_iso TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    vendor_or_party TEXT NOT NULL DEFAULT '',
    linked_animal_id TEXT NOT NULL DEFAULT '',
    linked_breeding_id TEXT NOT NULL DEFAULT '',
    linked_feed_batch_id TEXT NOT NULL DEFAULT '',
    linked_project_id TEXT NOT NULL DEFAULT '',
    receipt_photo_data_url TEXT NOT NULL DEFAULT '',
    receipt_photo_thumbnail_data_url TEXT NOT NULL DEFAULT '',
    receipt_photo_mime_type TEXT NOT NULL DEFAULT '',
    receipt_photo_bytes INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_entries_species ON ledger_entries(species);
  CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(date_iso);

  CREATE TABLE IF NOT EXISTS processing_logs (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    title TEXT NOT NULL,
    linked_animal_id TEXT NOT NULL DEFAULT '',
    linked_breeding_id TEXT NOT NULL DEFAULT '',
    scheduled_date_iso TEXT NOT NULL DEFAULT '',
    harvest_date_iso TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Processed',
    animal_count INTEGER NOT NULL DEFAULT 1,
    live_weight_grams INTEGER NOT NULL DEFAULT 0,
    dressed_weight_grams INTEGER NOT NULL DEFAULT 0,
    dress_out_percent REAL NOT NULL DEFAULT 0,
    pelt_count INTEGER NOT NULL DEFAULT 0,
    pelt_grade TEXT NOT NULL DEFAULT '',
    pelt_color_notes TEXT NOT NULL DEFAULT '',
    processing_cost_cents INTEGER NOT NULL DEFAULT 0,
    meat_value_cents INTEGER NOT NULL DEFAULT 0,
    pelt_value_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_processing_logs_species ON processing_logs(species);

  CREATE TABLE IF NOT EXISTS youth_project_books (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    organization TEXT NOT NULL DEFAULT '4-H',
    project_title TEXT NOT NULL,
    member_name TEXT NOT NULL DEFAULT '',
    club_or_chapter TEXT NOT NULL DEFAULT '',
    leader_or_advisor TEXT NOT NULL DEFAULT '',
    project_year TEXT NOT NULL DEFAULT '',
    start_date_iso TEXT NOT NULL DEFAULT '',
    end_date_iso TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Active',
    linked_animal_ids_json TEXT NOT NULL DEFAULT '[]',
    linked_breeding_ids_json TEXT NOT NULL DEFAULT '[]',
    starting_inventory_value_cents INTEGER NOT NULL DEFAULT 0,
    ending_inventory_value_cents INTEGER NOT NULL DEFAULT 0,
    feed_logs_json TEXT NOT NULL DEFAULT '[]',
    goals_and_reflection TEXT NOT NULL DEFAULT '',
    show_and_community_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_youth_project_books_species ON youth_project_books(species);

  CREATE TABLE IF NOT EXISTS client_contacts (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    full_name TEXT NOT NULL,
    ranch_or_herd_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    preferred_contact TEXT NOT NULL DEFAULT 'sms',
    client_kind TEXT NOT NULL DEFAULT 'pet_buyer',
    city_state TEXT NOT NULL DEFAULT '',
    shipping_address TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_client_contacts_species ON client_contacts(species);

  CREATE TABLE IF NOT EXISTS waitlist_entries (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    priority_rank INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Active',
    intent TEXT NOT NULL DEFAULT 'Show / Breeding',
    desired_breed TEXT NOT NULL DEFAULT '',
    desired_variety TEXT NOT NULL DEFAULT '',
    preferred_sex TEXT NOT NULL DEFAULT 'Any',
    preferred_breeding_id TEXT NOT NULL DEFAULT '',
    requested_by_date_iso TEXT NOT NULL DEFAULT '',
    inquiry_date_iso TEXT NOT NULL DEFAULT '',
    follow_up_date_iso TEXT NOT NULL DEFAULT '',
    last_contacted_date_iso TEXT NOT NULL DEFAULT '',
    max_budget_cents INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_waitlist_entries_species ON waitlist_entries(species);

  CREATE TABLE IF NOT EXISTS animal_reservations (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    agreement_number TEXT NOT NULL DEFAULT '',
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    waitlist_entry_id TEXT NOT NULL DEFAULT '',
    animal_id TEXT NOT NULL DEFAULT '',
    breeding_id TEXT NOT NULL DEFAULT '',
    pick_order INTEGER NOT NULL DEFAULT 0,
    item_label TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Pending Deposit',
    reserved_date_iso TEXT NOT NULL DEFAULT '',
    hold_expires_date_iso TEXT NOT NULL DEFAULT '',
    total_price_cents INTEGER NOT NULL DEFAULT 0,
    deposit_required_cents INTEGER NOT NULL DEFAULT 0,
    deposit_paid_cents INTEGER NOT NULL DEFAULT 0,
    deposit_due_date_iso TEXT NOT NULL DEFAULT '',
    deposit_paid_date_iso TEXT NOT NULL DEFAULT '',
    pickup_scheduled_date_iso TEXT NOT NULL DEFAULT '',
    completed_date_iso TEXT NOT NULL DEFAULT '',
    balance_reminder_date_iso TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT '',
    ledger_entry_id TEXT NOT NULL DEFAULT '',
    terms_summary TEXT NOT NULL DEFAULT '',
    health_guarantee_notes TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_animal_reservations_species ON animal_reservations(species);

  CREATE TABLE IF NOT EXISTS wool_harvests (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    animal_id TEXT NOT NULL,
    harvest_date_iso TEXT NOT NULL,
    shearing_interval_days INTEGER NOT NULL DEFAULT 0,
    prime_weight_grams INTEGER NOT NULL DEFAULT 0,
    grade_weight_grams INTEGER NOT NULL DEFAULT 0,
    harvest_method TEXT NOT NULL DEFAULT 'Sheared',
    staple_length_mm REAL NOT NULL DEFAULT 0,
    iagarb_score_json TEXT NOT NULL DEFAULT '{}',
    witnessed_by TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_wool_harvests_species ON wool_harvests(species);
  CREATE INDEX IF NOT EXISTS idx_wool_harvests_animal ON wool_harvests(animal_id);

  CREATE TABLE IF NOT EXISTS mileage_logs (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    date_iso TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'Show Travel',
    origin TEXT NOT NULL DEFAULT '',
    destination TEXT NOT NULL DEFAULT '',
    round_trip INTEGER NOT NULL DEFAULT 1,
    miles REAL NOT NULL DEFAULT 0,
    odometer_start REAL,
    odometer_end REAL,
    rate_cents_per_mile INTEGER NOT NULL DEFAULT 70,
    parking_and_tolls_cents INTEGER NOT NULL DEFAULT 0,
    linked_show_id TEXT NOT NULL DEFAULT '',
    linked_client_id TEXT NOT NULL DEFAULT '',
    vehicle_label TEXT NOT NULL DEFAULT '',
    tax_deductible INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_mileage_logs_species ON mileage_logs(species);
  CREATE INDEX IF NOT EXISTS idx_mileage_logs_date ON mileage_logs(date_iso);

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    entry_date_iso TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    color_category TEXT NOT NULL DEFAULT 'sage',
    star_rating INTEGER NOT NULL DEFAULT 0,
    tags_json TEXT NOT NULL DEFAULT '[]',
    pinned INTEGER NOT NULL DEFAULT 0,
    linked_animal_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_journal_entries_species ON journal_entries(species);
  CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date_iso);

  CREATE TABLE IF NOT EXISTS judge_clubs (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    club_name TEXT NOT NULL,
    sanctioning_body TEXT NOT NULL DEFAULT 'ARBA',
    contact_person TEXT NOT NULL DEFAULT '',
    role_title TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    city_state TEXT NOT NULL DEFAULT '',
    venue_name TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_judge_clubs_species ON judge_clubs(species);

  CREATE TABLE IF NOT EXISTS judge_assignments (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    show_name TEXT NOT NULL,
    club_id TEXT NOT NULL DEFAULT '',
    club_name TEXT NOT NULL DEFAULT '',
    sanctioning_body TEXT NOT NULL DEFAULT 'ARBA',
    show_date_iso TEXT NOT NULL,
    end_date_iso TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    venue_address TEXT NOT NULL DEFAULT '',
    assignment_role TEXT NOT NULL DEFAULT '',
    breeds_assigned TEXT NOT NULL DEFAULT '',
    bid_status TEXT NOT NULL DEFAULT 'Bid Submitted',
    bid_submitted_date_iso TEXT NOT NULL DEFAULT '',
    bid_response_due_iso TEXT NOT NULL DEFAULT '',
    contract_status TEXT NOT NULL DEFAULT 'Not Sent',
    contract_number TEXT NOT NULL DEFAULT '',
    contract_signed_date_iso TEXT NOT NULL DEFAULT '',
    judging_fee_cents INTEGER NOT NULL DEFAULT 0,
    per_diem_cents INTEGER NOT NULL DEFAULT 0,
    hotel_provided INTEGER NOT NULL DEFAULT 0,
    mileage_reimbursement_rate_cents INTEGER NOT NULL DEFAULT 70,
    estimated_miles REAL NOT NULL DEFAULT 0,
    actual_miles REAL NOT NULL DEFAULT 0,
    linked_mileage_log_id TEXT NOT NULL DEFAULT '',
    fee_paid INTEGER NOT NULL DEFAULT 0,
    fee_paid_date_iso TEXT NOT NULL DEFAULT '',
    contract_terms_summary TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_judge_assignments_species ON judge_assignments(species);
  CREATE INDEX IF NOT EXISTS idx_judge_assignments_date ON judge_assignments(show_date_iso);

  CREATE TABLE IF NOT EXISTS judge_expenses (
    id TEXT PRIMARY KEY NOT NULL,
    species TEXT NOT NULL,
    assignment_id TEXT NOT NULL DEFAULT '',
    date_iso TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    description TEXT NOT NULL,
    vendor TEXT NOT NULL DEFAULT '',
    amount_cents INTEGER NOT NULL DEFAULT 0,
    reimbursable INTEGER NOT NULL DEFAULT 1,
    reimbursed INTEGER NOT NULL DEFAULT 0,
    reimbursed_date_iso TEXT NOT NULL DEFAULT '',
    tax_deductible INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_judge_expenses_species ON judge_expenses(species);
  CREATE INDEX IF NOT EXISTS idx_judge_expenses_date ON judge_expenses(date_iso);
  CREATE INDEX IF NOT EXISTS idx_judge_expenses_assignment ON judge_expenses(assignment_id);
`;
