-- 0001_core_tables.sql
-- Phase 1 slice 1: the four core tables sketched in the PRD (issue #1).
-- RLS is enabled in the next migration; this file is the shape only.
--
-- The `visible` boolean on practitioners is a Phase 1 simplification.
-- ADR-0002 + ADR-0004 will eventually derive visibility from
-- verification_status, subscription_status, and a min-fields-filled
-- check; until those state machines exist, a hand-set flag lets the
-- smoke fixtures cover the visible/hidden split.

create extension if not exists pgcrypto;

create table public.practitioners (
  id                       uuid primary key default gen_random_uuid(),
  short_id                 text not null unique,

  full_name                text not null,
  goc_number               text not null unique,
  profession_code          text not null,
  email                    text not null unique,

  photo_url                text,
  bio                      text,
  services                 text[],
  languages                text[],
  accessibility_notes      text,
  accepting_new_patients   boolean not null default true,

  practice_name            text,
  practice_address_line1   text,
  practice_address_line2   text,
  practice_address_line3   text,
  practice_postcode        text,
  practice_town            text,
  practice_point           extensions.geography(Point, 4326),
  opening_hours            jsonb,
  by_appointment_only      boolean not null default false,
  booking_link_url         text,

  verification_status      text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'revoked')),
  last_verified_at         timestamptz,
  subscription_status      text not null default 'incomplete'
    check (subscription_status in ('incomplete', 'active', 'trialing', 'past_due', 'unpaid', 'canceled')),
  stripe_customer_id       text,
  stripe_subscription_id   text,

  visible                  boolean not null default false,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index practitioners_practice_point_gist
  on public.practitioners using gist (practice_point);

create index practitioners_visible_idx
  on public.practitioners (visible) where visible = true;

create table public.verifications (
  id                       uuid primary key default gen_random_uuid(),
  practitioner_id          uuid not null references public.practitioners(id) on delete cascade,
  status                   text not null
    check (status in ('pending', 'verified', 'rejected', 'revoked')),
  evidence_url             text,
  raw_register_snapshot    jsonb,
  scraped_at               timestamptz not null default now()
);

create index verifications_practitioner_scraped_at_idx
  on public.verifications (practitioner_id, scraped_at desc);

create table public.clickthroughs (
  id                       uuid primary key default gen_random_uuid(),
  practitioner_id          uuid not null references public.practitioners(id) on delete cascade,
  hashed_visitor           text not null,
  occurred_at              timestamptz not null default now()
);

create index clickthroughs_practitioner_idx
  on public.clickthroughs (practitioner_id);

create index clickthroughs_dedup_idx
  on public.clickthroughs (practitioner_id, hashed_visitor, occurred_at);

create table public.notify_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  email                    text not null,
  postcode                 text not null,
  point                    extensions.geography(Point, 4326),
  confirmed_at             timestamptz,
  unsubscribed_at          timestamptz,
  created_at               timestamptz not null default now(),
  unique (email, postcode)
);

create index notify_subscriptions_point_gist
  on public.notify_subscriptions using gist (point)
  where confirmed_at is not null and unsubscribed_at is null;
