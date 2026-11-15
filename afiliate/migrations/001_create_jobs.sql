create table if not exists jobs (
  id text primary key,
  owner text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null,
  source_url text not null,
  platform text not null,
  product jsonb not null default '{}'::jsonb,
  script_text text not null default '',
  caption text not null default '',
  error_message text,
  voice_mode text not null default 'none',
  post_status text,
  post_message text,
  affiliate_url text,
  video bytea,
  audio bytea,
  video_mime text,
  audio_mime text,
  duration_sec double precision
);

create table if not exists job_images (
  id text primary key,
  job_id text not null references jobs (id) on delete cascade,
  sort_order int not null,
  mime text not null,
  data bytea not null
);

create index if not exists jobs_owner_created on jobs (owner, created_at desc);
