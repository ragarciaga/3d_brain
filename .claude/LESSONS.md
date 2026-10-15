# Lessons

Project gotchas, written as instructions to a future agent. One entry per real incident,
1 to 3 lines, dated, newest last. Only the orchestrator (main session) appends here.
Planner and implementer prompts include the entries relevant to their task.

Format:
- YYYY-MM-DD: <instruction>. Why: <what went wrong once>.

<!-- Entries below this line -->
- 2026-10-13: For an invariant test ("nothing moves", "nothing changes"), start from a state where a violation would be visible (several fragmentable pieces visible, non-trivial base) and assert every field that could move. Why: T2's R2.5 test passed by construction with one visible piece and explosion 0, and cost a kickback.
- 2026-10-13: Verifier and auditor cannot run `node scripts/...` or `npm run check:modelo` with arguments (guard); for script tasks the orchestrator runs the CLI exit-code checks itself in the mechanical check and quotes them in the PR. Why: T3's integration criterion was only observable in-process by the agents.
- 2026-10-13: Before building tasks in parallel (spec tasks or standalone rb:task issues), compare the Affected files of their plans (and shared areas: same component, same i18n block, same CSS block); any overlap means sequential, one task merged before the next starts. Only tasks with disjoint files run in parallel. Why: #58, #62 and #63 were built at once, all touched PanelRevision.tsx, and each merge forced conflict resolution plus a new verifier and auditor round on the others (editor rule).
- 2026-10-14: In Playwright, to assert something is absent during a transient state (a request in flight), read once (`expect(await loc.count()).toBe(0)`), never `toHaveCount(0)`, and hold the request with a promise in the route handler (`retenerAutorizar`, like `retenerLeer`) so the state lasts. Why: in T10 `toHaveCount(0)` retried until the request timed out and the state reverted, so the mutant survived and cost a kickback.
- 2026-10-14: `getByRole('button')` finds nothing inside a closed `<details>`; open its `summary` first. Why: T10's first VAG01 failed with "element(s) not found" although the entry was in `resto`.
- 2026-10-14: For self-mutation, mutate production code (or a shared helper such as `ALIAS_VALIDO`), never a test predicate: auto mode denies editing a test's guard as "Security Test Removal". Why: T11's mutation of `revisorPublico` in the test was denied mid-run.
- 2026-10-14: With `react-hooks/immutability`, declare a function before any `const` closure that calls it, even if the call happens later. Why: T9's `enviarTodo` had to move above `estadoUI`.
- 2026-10-15: `MeshBVH` reorders `geometry.index` in place, and the GLB shares index buffers between twin meshes (dedup), so building one tree broke its twin's; build trees with `construirBvh` (copies the index). Why: 01-T7, two brainstem nuclei had no outline and 24 meshes had broken touch.
- 2026-10-15: An e2e assertion `> 0` on a measured duration does not catch a misplaced mark when the remaining span has its own cost; measure the real and the mutated value and put the threshold between them. Why: #85, the touch-index mark moved before the BVH loop still gave 2 to 19 ms.
- 2026-10-15: Stop only the processes you started, by PID or port; never `pkill -f vite` or `pkill -f playwright` (other agents run them in other worktrees), and never run two Playwright processes in one worktree (they share test-results). Why: 03-T13's implementer killed its own run and broke traces.
