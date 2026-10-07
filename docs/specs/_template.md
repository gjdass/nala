# NN — Feature name

Status: idea | specified | in progress | done

<!-- Activity sections: start with "Builds on 04 — App layout: …" and describe only what differs from spec 04
     (section pattern, entry API conventions, offline queue, Timers). Never restate 04's rules. -->

## Goal

One or two sentences: what problem this solves for the parent.

## Kinds

<!-- Activity sections only: kinds of entry, their icons, sheet titles; whether + opens the kind picker; section icon. -->

| Kind | Icon | Sheet title |
|------|------|-------------|
| … | … | … |

## Decisions

Settled rules, kept up to date: when a decision changes, rewrite it here (never append a contradicting one).

- **Endpoints:** for a section, the resource, body fields, list order, not-found code and any endpoint beyond spec 04's conventions.
- **Validation codes:** the section's own codes.
- **Card highlight**, list item and sheet specifics.
- …

## User stories

- As a parent, I want to … so that …

## Acceptance criteria

Each item becomes at least one test, written failing first.

### Shared criteria
<!-- Activity sections: one line per shared group of spec 04 that applies. -->
- [ ] Spec 04's shared entry criteria hold for <entries>.

### …
- [ ] …

## Build slices

<!-- Added by /slice before the first one is built. Once the spec is done, collapse to:
     Built in N slices, all done; each is a commit "Spec NN slice N: …" (`git log --grep "Spec NN slice"`). -->

Each slice goes red → green → commit on `master`, in this order.

- [ ] **Slice 1 — …** What it builds. Covers: …

## Data

What is stored: entities, fields, relations to existing data.

## UI notes

Section colour token, shared components reused or built, labels (EN / FR).

## Out of scope

What this feature deliberately does not do (global rules from the overview, e.g. no photos or notifications, need not be repeated).

## Open questions

- …
