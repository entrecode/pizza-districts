-- Roll back 0020_harness_test_role.sql.
-- Apply before 0012_sim_commit_ticks.down.sql.
--
-- DROP ROLE fails if the role still owns objects or holds grants. Test
-- migrations that grant EXECUTE on test-tagged functions to
-- harness_test must be rolled back first; in dev, `reassign owned by
-- harness_test to postgres; drop owned by harness_test;` is the
-- nuclear option.

revoke all on schema public from harness_test;
drop role if exists harness_test;
