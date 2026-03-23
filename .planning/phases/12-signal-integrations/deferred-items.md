# Deferred Items — Phase 12 Signal Integrations

## Pre-existing TypeScript Errors (out of scope for Plan 02)

These errors existed before Plan 02 and are unrelated to the adapter implementations.

### artifacts/api-server/src/routes/monitoring.ts:93
```
Type 'Date' is not assignable to type 'string | SQL<unknown> | ...'
```

### artifacts/api-server/src/routes/vendors.ts:633
```
Type 'Date' is not assignable to type 'string | SQL<unknown> | ...'
```

### artifacts/riskmind-app/src/pages/signals/signal-list.tsx (multiple)
```
Type 'string' is not assignable to type 'number'
```

### artifacts/riskmind-app/src/pages/vendors/vendor-list.tsx (multiple)
```
Type 'string' is not assignable to type 'number'
Type 'string | undefined' is not assignable to type 'string'
```

**Action:** Fix in a dedicated cleanup plan or future quick task. Not caused by Plan 02 changes.
