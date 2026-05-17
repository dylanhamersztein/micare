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
