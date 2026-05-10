# Summary

<!-- 1–3 bullets on what changed and why. Link the tracking issue. -->

## Test plan

<!-- Bulleted checklist of what you ran / what you verified. -->

## Public-build hygiene checklist

- [ ] If this PR adds **any** dev-seed identifier — synthetic POI prefix
      (`dev_*` / `qa_*` / `test_*` / `smoke_*`), test user UUID/email,
      `engine_version` sentinel, fixture id, dev-only Supabase row marker, or
      dev-only feature seed — I added it to
      [`docs/dev-seed-registry.md`](../docs/dev-seed-registry.md) in the same
      PR. (Required by row 12 of the Pre-Public-Build Checklist — issue
      PIZ-54.)
- [ ] No client-bundled secrets (no `SUPABASE_SERVICE_ROLE_KEY` /
      `GOOGLE_PLACES_SERVER_KEY` reachable from anything that runs in the
      browser).
