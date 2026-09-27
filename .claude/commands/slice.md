---
description: Build the next vertical slice of a spec, test-first, and commit it
argument-hint: <spec number, e.g. 04 or 10>
---

Build the next slice of spec `$ARGUMENTS` from `docs/specs/`.

1. **Prepare**
   - `git status` must be clean and the branch must be `master`. If not, stop and tell me.
   - Read the spec file `docs/specs/$ARGUMENTS-*.md`, every spec it references, and the `CLAUDE.md` of each layer you will touch (`web/`, `api/`).
   - Re-read the hard requirements in the overview that concern this spec.

2. **Slices**
   - If the spec has no "Build slices" section yet: enter plan mode and propose one. Each slice is a small end-to-end increment (DB → API → UI as needed), lists the acceptance criteria it covers, and is ordered so each builds on the previous. Once I approve, add the section to the spec as a checklist and commit it ("Add build slices to spec NN"), then continue with the first slice.
   - Otherwise take the first unchecked slice. Tell me which slice and criteria you are building before starting.

3. **Red**
   - Write the tests for the slice's acceptance criteria (API: NUnit in `Nala.Tests`; web: unit tests next to the component/service).
   - Run them and show that they fail, and that they fail for the expected reason.

4. **Green**
   - Implement the minimum to make them pass, reusing existing shared components and Core services before creating new ones. Follow the Material 3 mapping in `docs/specs/03-app-layout.md`; no hard-coded colours.
   - Refactor with tests green.
   - Run the **full** test suites and lint of every touched layer, and the build. All must pass.

5. **Update the spec**
   - Tick the acceptance criteria now covered by passing tests, and tick the slice.
   - Set the spec's status (and its row in the overview) to `in progress`, or `done` when every criterion is ticked.
   - If anything was decided or changed during the slice, update the spec to match — never leave the spec and the code disagreeing.

6. **Commit**
   - Commit on `master` with a message naming the spec and the slice. Do not push.

7. **Stop.** Report what was built, the test results, and anything unclear or deferred. Do not start the next slice.

If the spec is ambiguous or silent on something that matters, ask me instead of inventing behaviour.
