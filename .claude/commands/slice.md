---
description: Build the next vertical slice of a spec, test-first, and commit it
argument-hint: <spec number, e.g. 01 or 05>
---

Build the next slice of spec `$ARGUMENTS` from `docs/specs/`.

1. **Prepare**
   - `git status` must be clean and the branch must be `master`. If not, stop and tell me.
   - Read the spec file `docs/specs/$ARGUMENTS-*.md`, every spec it references, and the `CLAUDE.md` of each layer you will touch (`web/`, `api/`).
   - Re-read the hard requirements in the overview that concern this spec.

2. **Slices**
   - If the spec has no "Build slices" section yet: enter plan mode and propose one. Each slice is a small end-to-end increment (DB → API → UI as needed), lists the acceptance criteria it covers, and is ordered so each builds on the previous. Wait for my approval. Once approved, add the section to the spec as a checklist and commit it ("Add build slices to spec NN").
   - Pick the first unchecked slice.

3. **Plan the slice — wait for approval**
   - Enter plan mode (read-only) and present the slice plan:
     - the slice and the acceptance criteria it covers;
     - the tests you will write (file, test name, what each asserts);
     - the files you will create or change, per layer;
     - shared components and Core services reused, and new ones created;
     - database changes (entities, migration);
     - new dependencies (packages) and why;
     - anything the spec doesn't settle, as questions.
   - Do not write or change any file until I approve the plan. If I ask for changes, revise and present it again.

4. **Red**
   - Write the tests for the slice's acceptance criteria (API: NUnit in `Nala.Tests`; web: unit tests next to the component/service).
   - Run only those tests (web: `npm test -- --watch=false <path>`; API: `dotnet test --filter "FullyQualifiedName~<Class>"`) and show that they fail, and that they fail for the expected reason.

5. **Green**
   - Implement the minimum to make them pass, following the approved plan (tell me if you have to deviate from it), reusing existing shared components and Core services before creating new ones. Follow the Material 3 mapping in `docs/specs/04-app-layout.md`; no hard-coded colours.
   - Refactor with tests green. While iterating, run only the new and touched tests (same filters as in Red).
   - Then run the **full** test suites and lint of every touched layer, and the build, once as the final gate. All must pass. If something fails, read only the failing tests' messages (API: `--logger "console;verbosity=minimal"`), fix with filtered runs, then rerun the full suites.

6. **Update the spec**
   - Tick the acceptance criteria now covered by passing tests, and tick the slice.
   - Set the spec's status (and its row in the overview) to `in progress`, or `done` when every criterion is ticked.
   - If anything was decided or changed during the slice, update the spec to match — never leave the spec and the code disagreeing. Rewrite or remove the text that changed (in this spec and in any other spec it contradicts) instead of appending a new paragraph; a rule shared by several sections goes into spec 04.
   - When the spec becomes `done`, collapse its Build slices to one line: `Built in N slices, all done; each is a commit "Spec NN slice N: …" (git log --grep "Spec NN slice").`

7. **Commit**
   - Commit on `master` with a message naming the spec and the slice. Do not push.

8. **Stop.** Report what was built, the test results, and anything unclear or deferred. Do not start the next slice.

If the spec is ambiguous or silent on something that matters, ask me instead of inventing behaviour.
