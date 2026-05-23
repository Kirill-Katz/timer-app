Build a Vue PWA time tracker with Supabase as the remote database and IndexedDB as the local offline database.

Supabase credentials are in `.env.local`.

The login email is restricted in the frontend through `VITE_ALLOWED_EMAIL`, defaulting to `cat.chirill@gmail.com`.

This is a personal single-user application, but it still authenticates through Supabase so RLS can use `auth.uid()`.

```sql
create table projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),

    name text not null,
    color text not null,

    archived boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),

    project_id uuid not null references projects(id) on delete cascade,

    name text not null,

    archived boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table time_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),

    project_id uuid not null references projects(id) on delete cascade,

    task_id uuid references tasks(id) on delete set null,

    start_time timestamptz not null,
    end_time timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    deleted_at timestamptz
);
```

The app has three main entities:

projects:
- create
- update name/color
- archive/unarchive

tasks:
- create under project
- update name
- archive/unarchive

time_logs:
- create from start/stop timer
- update project/task/start_time/end_time
- soft delete by setting deleted_at

Implement offline-first behavior.

Use IndexedDB for:
1. local cached copies of projects, tasks, and time_logs
2. a durable operation queue

The operation queue should behave like a FIFO/deque:

operation_queue:
- id
- user_id
- entity_type: "project" | "task" | "time_log"
- entity_id
- operation: "create" | "update" | "delete" | "archive" | "unarchive"
- payload JSON
- status: "pending" | "saved_locally"
- created_at

When the user performs an action:
1. append an operation to the local operation queue
2. apply the change immediately to IndexedDB
3. mark the operation as saved_locally
4. try to sync it to Supabase if online

Operations must be synced in order from oldest to newest. Only sync the front operation. If it succeeds, remove it from the queue and continue. If it fails, stop syncing and retry later.

Add a periodic background sync worker that:
- checks navigator.onLine
- retries the queue
- also runs when the app starts
- also runs when the browser fires the online event

Do not store the queue only in RAM. It must survive page reloads and browser restarts.

Use Supabase auth:
- get the current user with supabase.auth.getUser()
- every remote row must include user_id
- local data and queued operations should be scoped by user_id

Expected UI:
- project list
- task list per project
- start/stop timer
- time log list with a dedicated edit screen for existing logs
- archive project/task
- visible sync status indicator: online/offline, pending operations count

Use TypeScript. Keep code clean and split logic into services:
- Supabase client
- IndexedDB/local database
- sync queue
- project/task/time log stores
