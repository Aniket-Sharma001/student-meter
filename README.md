# STUDENT METER

Student Meter is a static, local-first student productivity website. Its existing study, timer, routine, money, mood, goals, challenges, reminders and Student Vault features remain usable without an account. Optional cloud accounts use Supabase Auth with per-user relational Vault records and revision-checked app-data sync.

## Local run

Run the site from `localhost` (rather than opening `index.html` directly):

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/`. Python 3 must be installed. HTTPS or localhost is also required for browser password-reset redirects and some browser APIs.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/migrations/001_student_meter_cloud.sql`](supabase/migrations/001_student_meter_cloud.sql).
3. In Supabase Authentication, enable email/password sign-in and configure the email confirmation and password recovery templates.
4. Add `http://localhost:8000/**` to the Supabase Auth URL Configuration's allowed redirect URLs. Add the HTTPS production origin before deployment.
5. Copy the project URL and the **publishable/anon browser key** into `js/cloud-config.js`:

   ```js
   window.STUDENT_METER_CLOUD_CONFIG = Object.freeze({
     supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
     supabaseAnonKey: 'YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY'
   });
   ```

   The URL and anon/publishable key are intended for browser use. The database Row Level Security policies are the security boundary.
6. Never put a service-role key, database password, private API key or server secret in this project, a frontend environment file, or browser code.
7. Serve the project over localhost/HTTPS and open `account.html`. Create a test account, confirm the email if requested, then log in.
8. When local data is found, choose Upload Local Data, Keep Cloud Data, Merge non-conflicting records, Replace Cloud Data or Start Fresh. The site does not silently choose to overwrite existing cloud data.
9. Add a branch, semester, subject and note in Student Vault. Check the account indicator, log out, log in again, and verify the records. Repeat in a second browser/device to check account sync.
10. Test user isolation with two different accounts. User B must see only B's data. Also test direct table access while logged out and try changing the `user_id` to another user's UUID; RLS must reject both.
11. Test password reset using the link in the email, disconnect the network and make a local edit, then reconnect and verify the sync status and conflict prompt.
12. Export a backup from Student Vault before trying Import. Import validates the file and asks for confirmation. Authentication sessions and credentials are not included.

## Cloud data and security model

- Supabase Auth owns passwords and persistent browser sessions; Student Meter never saves raw passwords.
- `profiles` contains only the user's optional name, course and college.
- `branches`, `semesters`, `subjects` and `vault_items` are relational, user-owned tables with composite owner/parent foreign keys and cascading deletes. Their `record` JSONB fields preserve the existing IndexedDB shape while searchable and relational fields remain typed columns.
- `student_meter_data` stores a user's existing `student-meter:` app settings/progress keys and a revision used for optimistic concurrency. The Vault rows are stored separately in the relational tables.
- `get_student_meter_data()` reads the authenticated user's own relational records into the existing local Vault shape. `sync_student_meter_data()` validates the snapshot, uses `auth.uid()` as its owner (never a caller-supplied owner id), checks the expected revision and replaces the rows atomically.
- All user-owned tables have RLS enabled. Policies require `auth.uid() = user_id` for every read/write/delete, and the cloud data revision is checked so stale device writes are rejected instead of silently overwriting newer data.
- The browser uses the authenticated session and the public anon key only. Supabase Auth's session persistence is managed by its client library.
- Concurrent edits to different record IDs can be merged. When both copies changed the same record or app-data setting, Student Meter stops the merge and asks the student to keep the cloud or local version. It does not auto-resolve conflicts by timestamp.
- The user can explicitly clear/replace their own snapshot while signed in. Auth-user deletion is deliberately not offered as a frontend action: deleting the Supabase Auth user requires a trusted server/Edge Function with a server-only service-role key.

### Configure safely

`js/cloud-config.js` is a frontend-safe configuration file for the Supabase project URL and public anon/publishable key. It is not a place for secrets. Do not check in private keys. For local-only use, leave the two values empty; the website will clearly show that cloud accounts are not configured.

## Backups and offline behavior

- **User export backup:** a downloadable JSON backup of Student Vault and the existing Student Meter local settings/progress. It does not contain passwords or Supabase session tokens. Keep a copy somewhere separate from the device.
- **Cloud database backup:** Supabase's database backup/point-in-time-recovery availability depends on the selected Supabase plan and project configuration. This project does not claim that a provider backup schedule has been configured. Check the Supabase project's Backups settings and plan.
- **Local device cache:** IndexedDB and localStorage keep the website usable on this browser. While logged out or offline, edits stay on the device. Signed-in edits queue locally and try to sync after connectivity returns; the UI must not be interpreted as synced until it reports `🟢 Synced`.

## Scope and limitations

This integration syncs the existing Student Vault and the data stored through Student Meter's `student-meter:` local data layer, including study progress, profile, reminder settings, routines, money, mood, goals, challenges, XP, timer data and theme. Student-life scenarios are generated interactively and do not have persistent records to sync.

The cloud integration is optional and requires the student's own Supabase project and configuration. The browser-based website cannot promise background notifications after it has been closed.
