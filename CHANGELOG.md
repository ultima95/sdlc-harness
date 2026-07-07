# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Release notes are now sourced from this `CHANGELOG.md` (the Release workflow publishes
  the tagged version's section as the release body), instead of auto-generated commit lists.

## [0.3.0] - 2026-07-07

### Added

- `/sdlc config` command to view, edit, and validate `.sdlc/config.yml`:
  - `show` (default) — print settings grouped by section with allowed values.
  - `get <key>` — print a single value by dotted path (e.g. `gates.review`).
  - `set <key> <value>` — validate against a baked-in schema and rewrite one line,
    preserving indentation and inline comments.
  - `check` — static validation (`OK`/`WARN`/`ERR` + summary); exits non-zero on any
    error, so it works in CI.
- Zero new dependencies — a hand-rolled YAML-subset parser, matching the harness's
  zero-dependency design.

### Fixed

- `/sdlc config set` now preserves the alignment padding before an inline comment when
  it rewrites a line (previously the gap collapsed to a single space).

## [0.2.2] - 2026-07-07

### Fixed

- Harness state under `.sdlc/` is committed alongside the code it describes, instead of
  being left as an uncommitted pile.

## [0.2.1] - 2026-07-07

### Added

- Tag-triggered GitHub release workflow (`.github/workflows/release.yml`).

### Fixed

- `/sdlc cleanup` handles squash- and rebase-merged pull requests when verifying a merge.

## [0.2.0] - 2026-07-07

### Added

- Feature-branch lifecycle: create `<type>/<slug>` at Implement, push and open a PR at
  Ship, and `/sdlc cleanup` after merge.
- `/sdlc backlog` to groom deferred work in `.sdlc/backlog.md`.

[Unreleased]: https://github.com/ultima95/sdlc-harness/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ultima95/sdlc-harness/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/ultima95/sdlc-harness/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/ultima95/sdlc-harness/releases/tag/v0.2.1
[0.2.0]: https://github.com/ultima95/sdlc-harness/releases/tag/v0.2.0
