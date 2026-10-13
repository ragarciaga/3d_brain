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
