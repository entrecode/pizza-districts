// /play — MapShell + perf gate surface ([PIZ-17](/PIZ/issues/PIZ-17), [PIZ-16](/PIZ/issues/PIZ-16)).
// Public in Phase 1 so CI can exercise /play without a Supabase session.

import { PlayPageBody } from "./_components/PlayPageBody";

export const dynamic = "force-static";

export default function PlayPage() {
  return <PlayPageBody />;
}
