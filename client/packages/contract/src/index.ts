import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCZ7CDQ56HN3NVRLV2WM7BKYWPWVVN3NTDYWSZIFLOALCTYPTU7KW7L5",
  }
} as const


export interface Game {
  commit1: Buffer;
  commit2: Option<Buffer>;
  deadline: u64;
  move1: Option<u32>;
  move2: Option<u32>;
  player1: string;
  player2: Option<string>;
  status: Status;
  timeout: u64;
  token: string;
  wager: i128;
}

/**
 * Open = waiting for player 2 to join.
 * Committed = both players committed, revealing moves.
 * Resolved = finished (win / draw / forfeit / cancel).
 */
export type Status = {tag: "Open", values: void} | {tag: "Committed", values: void} | {tag: "Resolved", values: void};

export type DataKey = {tag: "Game", values: readonly [u64]} | {tag: "NextId", values: void};

export interface Client {
  /**
   * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Read-only: full game state.
   */
  get_game: ({game_id}: {game_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Game>>

  /**
   * Construct and simulate a join_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Join an open game. Player2 locks a matching wager and submits their
   * own commit hash. The reveal deadline starts ticking from here.
   */
  join_game: ({player, game_id, commit}: {player: string, game_id: u64, commit: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cancel_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel an un-joined game after its join window lapsed. Refunds the
   * creator's locked wager. Only the creator can call this.
   */
  cancel_game: ({game_id, player}: {game_id: u64, player: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a new RPS game. Player1 locks their wager and submits a commit
   * hash of their secret move. Returns the game_id.
   * `timeout` is the reveal window in seconds (also applies to joining).
   */
  create_game: ({player, wager, token, commit, timeout}: {player: string, wager: i128, token: string, commit: Buffer, timeout: u64}, options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a reveal_move transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Reveal your move+salt. Contract verifies SHA-256(move||salt) == commit,
   * so only the pre-committed move is accepted. Auto-resolves the game and
   * pays out the pot when both moves are on the table.
   */
  reveal_move: ({player, game_id, mv, salt}: {player: string, game_id: u64, mv: u32, salt: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a claim_timeout transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Timeout forfeit: if the opponent failed to reveal before the deadline
   * while you did, claim the entire pot.
   */
  claim_timeout: ({game_id, player}: {game_id: u64, player: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABEdhbWUAAAALAAAAAAAAAAdjb21taXQxAAAAA+4AAAAgAAAAAAAAAAdjb21taXQyAAAAA+gAAAPuAAAAIAAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAVtb3ZlMQAAAAAAA+gAAAAEAAAAAAAAAAVtb3ZlMgAAAAAAA+gAAAAEAAAAAAAAAAdwbGF5ZXIxAAAAABMAAAAAAAAAB3BsYXllcjIAAAAD6AAAABMAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAZTdGF0dXMAAAAAAAAAAAAHdGltZW91dAAAAAAGAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABXdhZ2VyAAAAAAAACw==",
        "AAAAAgAAAI5PcGVuID0gd2FpdGluZyBmb3IgcGxheWVyIDIgdG8gam9pbi4KQ29tbWl0dGVkID0gYm90aCBwbGF5ZXJzIGNvbW1pdHRlZCwgcmV2ZWFsaW5nIG1vdmVzLgpSZXNvbHZlZCA9IGZpbmlzaGVkICh3aW4gLyBkcmF3IC8gZm9yZmVpdCAvIGNhbmNlbCkuAAAAAAAAAAAABlN0YXR1cwAAAAAAAwAAAAAAAAAAAAAABE9wZW4AAAAAAAAAAAAAAAlDb21taXR0ZWQAAAAAAAAAAAAAAAAAAAhSZXNvbHZlZA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAEAAAAAAAAABEdhbWUAAAABAAAABgAAAAAAAAAAAAAABk5leHRJZAAA",
        "AAAAAAAAABtSZWFkLW9ubHk6IGZ1bGwgZ2FtZSBzdGF0ZS4AAAAACGdldF9nYW1lAAAAAQAAAAAAAAAHZ2FtZV9pZAAAAAAGAAAAAQAAB9AAAAAER2FtZQ==",
        "AAAAAAAAAIJKb2luIGFuIG9wZW4gZ2FtZS4gUGxheWVyMiBsb2NrcyBhIG1hdGNoaW5nIHdhZ2VyIGFuZCBzdWJtaXRzIHRoZWlyCm93biBjb21taXQgaGFzaC4gVGhlIHJldmVhbCBkZWFkbGluZSBzdGFydHMgdGlja2luZyBmcm9tIGhlcmUuAAAAAAAJam9pbl9nYW1lAAAAAAAAAwAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAAdnYW1lX2lkAAAAAAYAAAAAAAAABmNvbW1pdAAAAAAD7gAAACAAAAAA",
        "AAAAAAAAAHpDYW5jZWwgYW4gdW4tam9pbmVkIGdhbWUgYWZ0ZXIgaXRzIGpvaW4gd2luZG93IGxhcHNlZC4gUmVmdW5kcyB0aGUKY3JlYXRvcidzIGxvY2tlZCB3YWdlci4gT25seSB0aGUgY3JlYXRvciBjYW4gY2FsbCB0aGlzLgAAAAAAC2NhbmNlbF9nYW1lAAAAAAIAAAAAAAAAB2dhbWVfaWQAAAAABgAAAAAAAAAGcGxheWVyAAAAAAATAAAAAA==",
        "AAAAAAAAALpDcmVhdGUgYSBuZXcgUlBTIGdhbWUuIFBsYXllcjEgbG9ja3MgdGhlaXIgd2FnZXIgYW5kIHN1Ym1pdHMgYSBjb21taXQKaGFzaCBvZiB0aGVpciBzZWNyZXQgbW92ZS4gUmV0dXJucyB0aGUgZ2FtZV9pZC4KYHRpbWVvdXRgIGlzIHRoZSByZXZlYWwgd2luZG93IGluIHNlY29uZHMgKGFsc28gYXBwbGllcyB0byBqb2luaW5nKS4AAAAAAAtjcmVhdGVfZ2FtZQAAAAAFAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAABXdhZ2VyAAAAAAAACwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZjb21taXQAAAAAA+4AAAAgAAAAAAAAAAd0aW1lb3V0AAAAAAYAAAABAAAABg==",
        "AAAAAAAAAMFSZXZlYWwgeW91ciBtb3ZlK3NhbHQuIENvbnRyYWN0IHZlcmlmaWVzIFNIQS0yNTYobW92ZXx8c2FsdCkgPT0gY29tbWl0LApzbyBvbmx5IHRoZSBwcmUtY29tbWl0dGVkIG1vdmUgaXMgYWNjZXB0ZWQuIEF1dG8tcmVzb2x2ZXMgdGhlIGdhbWUgYW5kCnBheXMgb3V0IHRoZSBwb3Qgd2hlbiBib3RoIG1vdmVzIGFyZSBvbiB0aGUgdGFibGUuAAAAAAAAC3JldmVhbF9tb3ZlAAAAAAQAAAAAAAAABnBsYXllcgAAAAAAEwAAAAAAAAAHZ2FtZV9pZAAAAAAGAAAAAAAAAAJtdgAAAAAABAAAAAAAAAAEc2FsdAAAAA4AAAAA",
        "AAAAAAAAAGpUaW1lb3V0IGZvcmZlaXQ6IGlmIHRoZSBvcHBvbmVudCBmYWlsZWQgdG8gcmV2ZWFsIGJlZm9yZSB0aGUgZGVhZGxpbmUKd2hpbGUgeW91IGRpZCwgY2xhaW0gdGhlIGVudGlyZSBwb3QuAAAAAAANY2xhaW1fdGltZW91dAAAAAAAAAIAAAAAAAAAB2dhbWVfaWQAAAAABgAAAAAAAAAGcGxheWVyAAAAAAATAAAAAA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    get_game: this.txFromJSON<Game>,
        join_game: this.txFromJSON<null>,
        cancel_game: this.txFromJSON<null>,
        create_game: this.txFromJSON<u64>,
        reveal_move: this.txFromJSON<null>,
        claim_timeout: this.txFromJSON<null>
  }
}