-- Slice 1 fixtures: one visible Practitioner, one hidden Practitioner,
-- one confirmed Notify Me subscription. Idempotent — re-running this
-- file against an already-seeded database is a no-op.
--
-- Geography functions are schema-qualified so the seed runs identically
-- on the local stack and the hosted Supabase project, regardless of the
-- connecting role's search_path.

insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  practice_name,
  practice_address_line1,
  practice_postcode,
  practice_town,
  practice_point,
  booking_link_url,
  verification_status,
  subscription_status,
  visible
)
values (
  'a1b2c3d4',
  'Jane Smith',
  '01-123456',
  'optician',
  'jane@smithoptical.example.co.uk',
  'Smith Optical',
  '12 Cheapside',
  'EC2V 6AA',
  'London',
  extensions.st_setsrid(extensions.st_makepoint(-0.0921, 51.5144), 4326)::extensions.geography,
  'https://smithoptical.example.co.uk/book',
  'verified',
  'active',
  true
)
on conflict (goc_number) do nothing;

insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  practice_name,
  practice_address_line1,
  practice_postcode,
  practice_town,
  practice_point,
  booking_link_url,
  verification_status,
  subscription_status,
  visible
)
values (
  'd4c3b2a1',
  'John Doe',
  '01-654321',
  'optician',
  'john@doevision.example.co.uk',
  'Doe Vision Care',
  '34 Deansgate',
  'M3 2BW',
  'Manchester',
  extensions.st_setsrid(extensions.st_makepoint(-2.2467, 53.4794), 4326)::extensions.geography,
  'https://doevision.example.co.uk/book',
  'pending',
  'incomplete',
  false
)
on conflict (goc_number) do nothing;

-- Closer to EC2V 6AA than Jane Smith: Old Street, ~0.9 mi.
insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  practice_name,
  practice_address_line1,
  practice_postcode,
  practice_town,
  practice_point,
  booking_link_url,
  verification_status,
  subscription_status,
  visible
)
values (
  'e1f2g3h4',
  'Priya Patel',
  '01-222222',
  'optician',
  'priya@cityeyes.example.co.uk',
  'City Eyes',
  '1 Old Street',
  'EC1V 9HL',
  'London',
  extensions.st_setsrid(extensions.st_makepoint(-0.0876, 51.5258), 4326)::extensions.geography,
  'https://cityeyes.example.co.uk/book',
  'verified',
  'active',
  true
)
on conflict (goc_number) do nothing;

-- Within 15 mi of EC2V 6AA but outside 5 mi: Twickenham, ~9 mi.
insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  practice_name,
  practice_address_line1,
  practice_postcode,
  practice_town,
  practice_point,
  booking_link_url,
  verification_status,
  subscription_status,
  visible
)
values (
  'i5j6k7l8',
  'Marcus Owens',
  '01-333333',
  'optician',
  'marcus@meridianvision.example.co.uk',
  'Meridian Vision',
  '12 King Street',
  'TW1 3SN',
  'Twickenham',
  extensions.st_setsrid(extensions.st_makepoint(-0.3270, 51.4480), 4326)::extensions.geography,
  'https://meridianvision.example.co.uk/book',
  'verified',
  'active',
  true
)
on conflict (goc_number) do nothing;

-- Same coordinates as City Eyes but with an unfilled profile and a past_due
-- subscription: must be excluded by the visibility predicate even though
-- the column-level `visible` flag is true.
insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  practice_name,
  practice_postcode,
  practice_town,
  practice_point,
  verification_status,
  subscription_status,
  visible
)
values (
  'm9n0p1q2',
  'Hidden Practitioner',
  '01-444444',
  'optician',
  'hidden@example.co.uk',
  'Incomplete Practice',
  'EC1V 9HL',
  'London',
  extensions.st_setsrid(extensions.st_makepoint(-0.0876, 51.5258), 4326)::extensions.geography,
  'verified',
  'past_due',
  true
)
on conflict (goc_number) do nothing;

-- Slice 3 fixture: a visible Practitioner in Norwich (~1.293°E, 52.629°N).
-- Used by integration and e2e tests that search by city name "Norwich".
insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  practice_name,
  practice_address_line1,
  practice_postcode,
  practice_town,
  practice_point,
  booking_link_url,
  verification_status,
  subscription_status,
  visible
)
values (
  'n0r1w2c3',
  'Eleanor Hughes',
  '01-555555',
  'optician',
  'eleanor@castleeye.example.co.uk',
  'Castle Eye Care',
  '4 Castle Meadow',
  'NR1 3DD',
  'Norwich',
  extensions.st_setsrid(extensions.st_makepoint(1.2933, 52.6289), 4326)::extensions.geography,
  'https://castleeye.example.co.uk/book',
  'verified',
  'active',
  true
)
on conflict (goc_number) do nothing;

-- Slice 4 fixture: a fully-populated visible Practitioner in Bristol
-- (~ -2.588°E, 51.454°N). Exercises every field of the public profile page:
-- photo, bio, services, languages, accessibility notes, opening hours.
insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  photo_url,
  bio,
  services,
  languages,
  accessibility_notes,
  practice_name,
  practice_address_line1,
  practice_postcode,
  practice_town,
  practice_point,
  opening_hours,
  booking_link_url,
  verification_status,
  subscription_status,
  visible
)
values (
  's4l5u6g7',
  'Sophie Clarke',
  '01-666666',
  'optician',
  'sophie@clarkevision.example.co.uk',
  'https://clarkevision.example.co.uk/sophie.jpg',
  'Sophie has practised optometry in Bristol for over a decade, with a special interest in paediatric eye care.',
  array['Eye examinations', 'Contact lens fitting', 'Children''s eye care'],
  array['English', 'French'],
  'Step-free access; hearing loop available at reception.',
  'Clarke Vision',
  '8 Park Street',
  'BS1 5HX',
  'Bristol',
  extensions.st_setsrid(extensions.st_makepoint(-2.5879, 51.4545), 4326)::extensions.geography,
  '{"Monday":"9:00-17:30","Tuesday":"9:00-17:30","Wednesday":"9:00-17:30","Thursday":"9:00-19:00","Friday":"9:00-17:30","Saturday":"9:00-13:00","Sunday":"Closed"}',
  'https://clarkevision.example.co.uk/book',
  'verified',
  'active',
  true
)
on conflict (goc_number) do nothing;

-- Slice 4 fixture: a revoked Practitioner (struck off the GOC register).
-- ADR-0004 preserves the row but hides the profile; the page must show the
-- friendly "not currently listed" page, distinct from a generic 404.
insert into public.practitioners (
  short_id,
  full_name,
  goc_number,
  profession_code,
  email,
  practice_name,
  practice_address_line1,
  practice_postcode,
  practice_town,
  practice_point,
  booking_link_url,
  verification_status,
  subscription_status,
  visible
)
values (
  'r4v5o6k7',
  'Daniel Reed',
  '01-777777',
  'optician',
  'daniel@reedeyecare.example.co.uk',
  'Reed Eye Care',
  '20 Queen Street',
  'LS1 2TW',
  'Leeds',
  extensions.st_setsrid(extensions.st_makepoint(-1.5491, 53.7965), 4326)::extensions.geography,
  'https://reedeyecare.example.co.uk/book',
  'revoked',
  'canceled',
  false
)
on conflict (goc_number) do nothing;

insert into public.notify_subscriptions (
  email,
  postcode,
  point,
  confirmed_at
)
values (
  'subscriber@example.co.uk',
  'SW1A 1AA',
  extensions.st_setsrid(extensions.st_makepoint(-0.1419, 51.5014), 4326)::extensions.geography,
  now()
)
on conflict (email, postcode) do nothing;
