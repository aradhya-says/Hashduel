# Session Notes

## Trustless RPS wager game — COMPLETE (contract + client)
- Contract: `contract/contracts/contract/src/lib.rs` — commit-reveal RPS with token wagers.
  17/17 tests passing. Methods: `create_game`, `join_game`, `reveal_move` (sha256(move||salt)
  verified), `claim_timeout`, `cancel_game`, `get_game`. Draw refunds both; winner takes pot.
- ACTIVE deployment (user-provided, 2026-08-22): `CBUU2J4GJKI5XRRP74J3XVSPGQHL32RZQZDDKGE2FVRH2UIBM54ZXF3F`
  (baked into regenerated bindings as `networks.testnet.contractId`; verified live via RPC probe).
  Superseded: CDAOWRR7HWZDGIGW6H4PABCYLJASGCDH6LGIQS67XILWR7A72S6M3TYN.
  Old/dead: CDWSGS4RTLJXYOPIFZVVXIZ7UH656QS2APNMF6GEO3EGEM4MRTJ3PJFB (still on-chain, just unused).
- Liveness probe gotcha: simulating a getter on missing state gives
  `Error(WasmVm, InvalidAction)` (= wasm unreachable from Rust unwrap → contract LIVE);
  a nonexistent contract gives `Error(Storage, MissingValue)`. Don't confuse them.
- Wager token: USDC testnet by default (`NEXT_PUBLIC_TOKEN_ADDRESS` env override).
- Client: `hooks/contract.ts` (manual ScVal wrappers over lib/stellar.ts helpers),
  `components/Game.tsx` (create/join/reveal/claim/cancel UI), secrets in localStorage
  keyed `rps_<gameId>`.
- Earlier session: token contract (mint/burn/fee) was completed first; superseded by RPS app.

## Environment notes / gotchas
- Generated bindings package must be COMPILED before the Next build can resolve it:
  `cd client/packages/contract && bun run build` → produces `dist/index.js`.
  If `node_modules/contract` link is stale: `rm -rf node_modules/contract && bun install`.
- Scaffold's `src/app/favicon.ico` was corrupted (UTF-8-mangled bytes) and broke
  `next build` ("failed to fill whole buffer"). Replaced with a minimal valid
  16x16 32-bit BGRA ICO generated via a bun script.
- No python3 in this environment; use bun/node for one-off scripting.
- `#[should_panic]` only valid at test-fn level.

## Status
- `cargo test`: 17 passed. `bun run build`: success. Project fully wired end-to-end.
- Bindings regenerated + compiled + relinked for CDAOWR... deployment (2026-08-21).
- Re-verified 2026-08-22: 17/17 tests, clean client build, live probe OK on
  CBUU2J... (VM-trap-on-missing-state = live). Nothing pending; awaiting next user request.
