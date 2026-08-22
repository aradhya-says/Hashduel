import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from "@stellar/stellar-sdk/contract";
import type { u32, u64, i128, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CCZ7CDQ56HN3NVRLV2WM7BKYWPWVVN3NTDYWSZIFLOALCTYPTU7KW7L5";
    };
};
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
export type Status = {
    tag: "Open";
    values: void;
} | {
    tag: "Committed";
    values: void;
} | {
    tag: "Resolved";
    values: void;
};
export type DataKey = {
    tag: "Game";
    values: readonly [u64];
} | {
    tag: "NextId";
    values: void;
};
export interface Client {
    /**
     * Construct and simulate a get_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Read-only: full game state.
     */
    get_game: ({ game_id }: {
        game_id: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<Game>>;
    /**
     * Construct and simulate a join_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Join an open game. Player2 locks a matching wager and submits their
     * own commit hash. The reveal deadline starts ticking from here.
     */
    join_game: ({ player, game_id, commit }: {
        player: string;
        game_id: u64;
        commit: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a cancel_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Cancel an un-joined game after its join window lapsed. Refunds the
     * creator's locked wager. Only the creator can call this.
     */
    cancel_game: ({ game_id, player }: {
        game_id: u64;
        player: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a create_game transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Create a new RPS game. Player1 locks their wager and submits a commit
     * hash of their secret move. Returns the game_id.
     * `timeout` is the reveal window in seconds (also applies to joining).
     */
    create_game: ({ player, wager, token, commit, timeout }: {
        player: string;
        wager: i128;
        token: string;
        commit: Buffer;
        timeout: u64;
    }, options?: MethodOptions) => Promise<AssembledTransaction<u64>>;
    /**
     * Construct and simulate a reveal_move transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Reveal your move+salt. Contract verifies SHA-256(move||salt) == commit,
     * so only the pre-committed move is accepted. Auto-resolves the game and
     * pays out the pot when both moves are on the table.
     */
    reveal_move: ({ player, game_id, mv, salt }: {
        player: string;
        game_id: u64;
        mv: u32;
        salt: Buffer;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a claim_timeout transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Timeout forfeit: if the opponent failed to reveal before the deadline
     * while you did, claim the entire pot.
     */
    claim_timeout: ({ game_id, player }: {
        game_id: u64;
        player: string;
    }, options?: MethodOptions) => Promise<AssembledTransaction<null>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        get_game: (json: string) => AssembledTransaction<Game>;
        join_game: (json: string) => AssembledTransaction<null>;
        cancel_game: (json: string) => AssembledTransaction<null>;
        create_game: (json: string) => AssembledTransaction<bigint>;
        reveal_move: (json: string) => AssembledTransaction<null>;
        claim_timeout: (json: string) => AssembledTransaction<null>;
    };
}
