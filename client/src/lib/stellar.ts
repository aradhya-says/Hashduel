import {
  rpc,
  TransactionBuilder,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  signTransaction as freighterSign,
} from "@stellar/freighter-api";

// ── Constants ──
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

export const server = new rpc.Server(RPC_URL);

// ── Wallet ──
export async function ensureWalletConnected(): Promise<string> {
  const conn = await isConnected();
  if (!conn.isConnected) throw new Error("Freighter is not installed");
  const allowed = await isAllowed();
  if (!allowed.isAllowed) await requestAccess();
  const { address } = await getAddress();
  return address;
}

export async function getAddressSafe(): Promise<string | null> {
  try {
    const conn = await isConnected();
    if (!conn.isConnected) return null;
    const allowed = await isAllowed();
    if (!allowed.isAllowed) return null;
    const { address } = await getAddress();
    return address;
  } catch {
    return null;
  }
}

// ── ScVal Converters ──
export function toScValAddress(addr: string) {
  return nativeToScVal(new Address(addr), {});
}

export function toScValI128(value: bigint | string | number) {
  const v = typeof value === "string" || typeof value === "number" ? BigInt(value) : value;
  return nativeToScVal(v, { type: "i128" });
}

export function toScValU32(value: number) {
  return nativeToScVal(value, { type: "u32" });
}

export function toScValU64(value: bigint | number) {
  const v = typeof value === "number" ? BigInt(value) : value;
  return nativeToScVal(v, { type: "u64" });
}

export function toScValBytes(hex: string) {
  return nativeToScVal(Uint8Array.from(Buffer.from(hex, "hex")), { type: "bytes" });
}

export function toScValBytesRaw(data: Uint8Array) {
  return nativeToScVal(data, { type: "bytes" });
}

// ── Contract Read ──
export async function readContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<unknown> {
  const contract = new Contract(contractId);
  const account = await server.getAccount(contractId);
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if ("error" in sim) throw new Error(String(sim.error));
  const result = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
  if (!result) throw new Error("No return value");
  return scValToNative(result);
}

// ── Contract Write ──
export async function writeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  source: string
): Promise<string> {
  const contract = new Contract(contractId);
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();
  const sim = await server.simulateTransaction(tx);
  if ("error" in sim) throw new Error(String(sim.error));
  const assembled = rpc.assembleTransaction(
    tx,
    sim as rpc.Api.SimulateTransactionSuccessResponse
  ).build();
  const { signedTxXdr } = await freighterSign(assembled.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  const result = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
  );
  // Poll for confirmation
  if ("hash" in result) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const txResult = await server.getTransaction(result.hash);
      if (txResult.status !== "NOT_FOUND") {
        if (txResult.status === "FAILED") {
          throw new Error("Transaction failed on-chain");
        }
        return result.hash;
      }
    }
  }
  throw new Error("Transaction timeout waiting for confirmation");
}
