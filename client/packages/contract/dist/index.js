import { Buffer } from "buffer";
import { Client as ContractClient, Spec as ContractSpec, } from "@stellar/stellar-sdk/contract";
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
};
export class Client extends ContractClient {
    options;
    static async deploy(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options) {
        return ContractClient.deploy(null, options);
    }
    constructor(options) {
        super(new ContractSpec(["AAAAAQAAAAAAAAAAAAAABEdhbWUAAAALAAAAAAAAAAdjb21taXQxAAAAA+4AAAAgAAAAAAAAAAdjb21taXQyAAAAA+gAAAPuAAAAIAAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAVtb3ZlMQAAAAAAA+gAAAAEAAAAAAAAAAVtb3ZlMgAAAAAAA+gAAAAEAAAAAAAAAAdwbGF5ZXIxAAAAABMAAAAAAAAAB3BsYXllcjIAAAAD6AAAABMAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAZTdGF0dXMAAAAAAAAAAAAHdGltZW91dAAAAAAGAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABXdhZ2VyAAAAAAAACw==",
            "AAAAAgAAAI5PcGVuID0gd2FpdGluZyBmb3IgcGxheWVyIDIgdG8gam9pbi4KQ29tbWl0dGVkID0gYm90aCBwbGF5ZXJzIGNvbW1pdHRlZCwgcmV2ZWFsaW5nIG1vdmVzLgpSZXNvbHZlZCA9IGZpbmlzaGVkICh3aW4gLyBkcmF3IC8gZm9yZmVpdCAvIGNhbmNlbCkuAAAAAAAAAAAABlN0YXR1cwAAAAAAAwAAAAAAAAAAAAAABE9wZW4AAAAAAAAAAAAAAAlDb21taXR0ZWQAAAAAAAAAAAAAAAAAAAhSZXNvbHZlZA==",
            "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAEAAAAAAAAABEdhbWUAAAABAAAABgAAAAAAAAAAAAAABk5leHRJZAAA",
            "AAAAAAAAABtSZWFkLW9ubHk6IGZ1bGwgZ2FtZSBzdGF0ZS4AAAAACGdldF9nYW1lAAAAAQAAAAAAAAAHZ2FtZV9pZAAAAAAGAAAAAQAAB9AAAAAER2FtZQ==",
            "AAAAAAAAAIJKb2luIGFuIG9wZW4gZ2FtZS4gUGxheWVyMiBsb2NrcyBhIG1hdGNoaW5nIHdhZ2VyIGFuZCBzdWJtaXRzIHRoZWlyCm93biBjb21taXQgaGFzaC4gVGhlIHJldmVhbCBkZWFkbGluZSBzdGFydHMgdGlja2luZyBmcm9tIGhlcmUuAAAAAAAJam9pbl9nYW1lAAAAAAAAAwAAAAAAAAAGcGxheWVyAAAAAAATAAAAAAAAAAdnYW1lX2lkAAAAAAYAAAAAAAAABmNvbW1pdAAAAAAD7gAAACAAAAAA",
            "AAAAAAAAAHpDYW5jZWwgYW4gdW4tam9pbmVkIGdhbWUgYWZ0ZXIgaXRzIGpvaW4gd2luZG93IGxhcHNlZC4gUmVmdW5kcyB0aGUKY3JlYXRvcidzIGxvY2tlZCB3YWdlci4gT25seSB0aGUgY3JlYXRvciBjYW4gY2FsbCB0aGlzLgAAAAAAC2NhbmNlbF9nYW1lAAAAAAIAAAAAAAAAB2dhbWVfaWQAAAAABgAAAAAAAAAGcGxheWVyAAAAAAATAAAAAA==",
            "AAAAAAAAALpDcmVhdGUgYSBuZXcgUlBTIGdhbWUuIFBsYXllcjEgbG9ja3MgdGhlaXIgd2FnZXIgYW5kIHN1Ym1pdHMgYSBjb21taXQKaGFzaCBvZiB0aGVpciBzZWNyZXQgbW92ZS4gUmV0dXJucyB0aGUgZ2FtZV9pZC4KYHRpbWVvdXRgIGlzIHRoZSByZXZlYWwgd2luZG93IGluIHNlY29uZHMgKGFsc28gYXBwbGllcyB0byBqb2luaW5nKS4AAAAAAAtjcmVhdGVfZ2FtZQAAAAAFAAAAAAAAAAZwbGF5ZXIAAAAAABMAAAAAAAAABXdhZ2VyAAAAAAAACwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZjb21taXQAAAAAA+4AAAAgAAAAAAAAAAd0aW1lb3V0AAAAAAYAAAABAAAABg==",
            "AAAAAAAAAMFSZXZlYWwgeW91ciBtb3ZlK3NhbHQuIENvbnRyYWN0IHZlcmlmaWVzIFNIQS0yNTYobW92ZXx8c2FsdCkgPT0gY29tbWl0LApzbyBvbmx5IHRoZSBwcmUtY29tbWl0dGVkIG1vdmUgaXMgYWNjZXB0ZWQuIEF1dG8tcmVzb2x2ZXMgdGhlIGdhbWUgYW5kCnBheXMgb3V0IHRoZSBwb3Qgd2hlbiBib3RoIG1vdmVzIGFyZSBvbiB0aGUgdGFibGUuAAAAAAAAC3JldmVhbF9tb3ZlAAAAAAQAAAAAAAAABnBsYXllcgAAAAAAEwAAAAAAAAAHZ2FtZV9pZAAAAAAGAAAAAAAAAAJtdgAAAAAABAAAAAAAAAAEc2FsdAAAAA4AAAAA",
            "AAAAAAAAAGpUaW1lb3V0IGZvcmZlaXQ6IGlmIHRoZSBvcHBvbmVudCBmYWlsZWQgdG8gcmV2ZWFsIGJlZm9yZSB0aGUgZGVhZGxpbmUKd2hpbGUgeW91IGRpZCwgY2xhaW0gdGhlIGVudGlyZSBwb3QuAAAAAAANY2xhaW1fdGltZW91dAAAAAAAAAIAAAAAAAAAB2dhbWVfaWQAAAAABgAAAAAAAAAGcGxheWVyAAAAAAATAAAAAA=="]), options);
        this.options = options;
    }
    fromJSON = {
        get_game: (this.txFromJSON),
        join_game: (this.txFromJSON),
        cancel_game: (this.txFromJSON),
        create_game: (this.txFromJSON),
        reveal_move: (this.txFromJSON),
        claim_timeout: (this.txFromJSON)
    };
}
