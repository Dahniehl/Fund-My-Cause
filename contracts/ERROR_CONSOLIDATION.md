# Shared Error Enum Consolidation Audit

## Scope

Audit of the error enums defined by each contract crate:

- `contracts/common/src/error.rs` — `CommonError` (the shared base)
- `contracts/crowdfund/src/errors.rs` — `ContractError`
- `contracts/qf/src/lib.rs` — `QFError`
- `contracts/achievements/src/errors.rs` — `ContractError`
- `contracts/registry/src/errors.rs` — `ContractError`

## Findings

`contracts/common/src/error.rs` defines the shared base variants
(`Unauthorized`, `NotFound`, `InvalidInput`, `AlreadyInitialized`,
`AlreadyExists`, `NotInitialized`, `Paused`, `Overflow`), and `crowdfund`,
`achievements`, and `registry` implement `From<common::CommonError>` to compose
those shared variants into their own contract-specific error space while
preserving their existing, stable on-chain discriminants (each contract's
`#[contracterror]` enum keeps its own numbering rather than being replaced by
the shared enum, since Soroban error codes are part of the on-chain interface
and must not be renumbered).

`CommonError` carries eight variants (the six original base cases plus `Paused`
and `Overflow` added for the checked-arithmetic / pause work). Every contract's
`From<common::CommonError>` impl must therefore be exhaustive over all eight.
This pass closed the remaining gaps:

1. **`contracts/registry/src/errors.rs` — non-exhaustive `From` impl.** The
   `From<CommonError>` match was missing the `Paused` and `Overflow` arms (a
   compile error under exhaustive matching) and additionally contained a
   duplicate `NotInitialized` arm (an unreachable pattern). Fixed by removing
   the duplicate arm and adding:
   - `CommonError::Paused -> ContractError::Unauthorized`
   - `CommonError::Overflow -> ContractError::Unauthorized`
   The registry has no dedicated paused/overflow variant, so both fall back to
   the existing `Unauthorized` catch-all (the same mapping already used for
   `InvalidInput`).

2. **`contracts/qf/src/lib.rs` — non-exhaustive `From` impl.** The
   `From<common::CommonError> for QFError` match was missing `Paused` and
   `Overflow`. Fixed by adding:
   - `CommonError::Paused -> QFError::InvalidPoolAmount` (QF has no pause
     concept; folded into the generic pool-amount case already used for
     `Unauthorized`/`AlreadyInitialized`).
   - `CommonError::Overflow -> QFError::Overflow` (exact match).

3. **Tests.** Added `common_errors_map_to_expected_variants` tests for both
   `registry` and `qf` (mirroring the existing test in
   `contracts/achievements/src/errors.rs`) so every shared variant's mapping is
   pinned.

## Result

| Crate | Composes `CommonError`? | Notes |
|---|---|---|
| `contracts/common` | n/a (defines it) | Base enum: `Unauthorized`, `NotFound`, `InvalidInput`, `AlreadyInitialized`, `AlreadyExists`, `NotInitialized`, `Paused`, `Overflow` |
| `contracts/crowdfund` | Yes | All eight variants mapped |
| `contracts/achievements` | Yes | All eight variants mapped |
| `contracts/registry` | Yes | Fixed: removed duplicate `NotInitialized` arm; added `Paused`/`Overflow` -> `Unauthorized` |
| `contracts/qf` | Yes | Fixed: added `Paused` -> `InvalidPoolAmount`, `Overflow` -> `Overflow` |

## Acceptance criteria status

- [x] Shared error module exists in `contracts/common` (`CommonError` in
      `contracts/common/src/error.rs`).
- [x] All contracts (`crowdfund`, `qf`, `achievements`, `registry`) reference
      it for common variants via `From<common::CommonError>`, with every `From`
      impl now exhaustive over all eight `CommonError` variants and covered by
      mapping tests.
