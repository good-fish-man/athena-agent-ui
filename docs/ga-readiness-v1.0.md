# Athena Agent UI 1.0 - GA Operations Workspace

[English](ga-readiness-v1.0.md) | [简体中文](ga-readiness-v1.0.zh-CN.md)

The Operations workspace presents backend evidence; it does not manufacture
health or success values in the browser.

## What Administrators See

- aggregated GA status and individual readiness checks;
- evidence references supplied by Runtime Client and Launcher;
- encrypted backup inventory, create, verify, and restore controls;
- the stable ten-journey catalog;
- a non-destructive Golden Journey infrastructure preflight.

Status colors preserve protocol meaning. `EXTERNAL_REQUIRED` is deliberately
different from success and identifies work such as a real device flow,
installer test, signature, notarization, or soak test.

## Access and Safety

- Readiness and journey catalogs require authentication.
- Running the preflight and mutating backups require administrator access.
- Provider keys, website passwords, backup keys, and raw screenshot payloads
  are never rendered by this view.
- Restore and other destructive operations retain confirmation boundaries.

## Operator Workflow

1. Resolve `FAIL` entries from the source component first.
2. Connect a desktop device for browser and desktop gates.
3. Create and verify a backup.
4. Run the non-destructive preflight.
5. Complete external package/signing/soak checks outside the UI and retain their
   evidence with the release.

Use the trace ID shown by failed requests to correlate UI, Runtime Client,
Runtime, tool, and device logs.
