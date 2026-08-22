"use client";

import { networks, type Game as RawGame, type Status } from "contract";
import {
  readContract,
  writeContract,
  toScValAddress,
  toScValI128,
  toScValU32,
  toScValU64,
  toScValBytes,
  toScValBytesRaw,
  ensureWalletConnected,
} from "@/lib/stellar";

// ── Contract config ──
export const CONTRACT_ADDRESS = networks.testnet.contractId;

// Token address for wagers — USDC on testnet by default, configurable via env
export const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS ??
  "CDLZFC3SYJ6D5T5BBKVFRQPLDIISEL5BFRL5KZTBW3G5XJZVIKU5ESGS";

// ── Game interface (used by Game.tsx) ──
const STATUS_MAP = ["Open", "Committed", "Resolved"] as const;
export type GameStatus = (typeof STATUS_MAP)[number];

export interface Game {
  player1: string;
  player2: string | null;
  wager: bigint;
  token: string;
  commit1: string;
  commit2: string | null;
  move1: number | null;
  move2: number | null;
  status: GameStatus;
  deadline: bigint;
  timeout: bigint;
}

// ── Convert generated Status type to string ──
function statusToString(s: Status): GameStatus {
  if (s.tag === "Open") return "Open";
  if (s.tag === "Committed") return "Committed";
  return "Resolved";
}

// ── Crypto ──
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function computeCommitHash(
  move: number,
  salt: Uint8Array
): Promise<string> {
  const data = new Uint8Array([move, ...salt]);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hashBuf).toString("hex");
}

// ── Local secret storage ──
export function storeSecret(
  gameId: number,
  move: number,
  salt: Uint8Array
): void {
  localStorage.setItem(
    `rps_${gameId}`,
    JSON.stringify({ move, salt: Array.from(salt) })
  );
}

export function getSecret(
  gameId: number
): { move: number; salt: Uint8Array } | null {
  const raw = localStorage.getItem(`rps_${gameId}`);
  if (!raw) return null;
  const p = JSON.parse(raw);
  return { move: p.move, salt: new Uint8Array(p.salt) };
}

// ── Parse raw RPC result into Game ──
function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") return BigInt(v);
  return BigInt(0);
}

function toHex(v: unknown): string {
  if (!v) return "";
  if (v instanceof Uint8Array || Buffer.isBuffer(v))
    return Buffer.from(v).toString("hex");
  if (typeof v === "string") return v;
  return "";
}

function parseGameStatus(raw: unknown): GameStatus {
  // Handle generated Status object {tag: "Open"}
  if (raw && typeof raw === "object" && "tag" in raw) {
    return statusToString(raw as Status);
  }
  // Handle numeric variant index
  if (typeof raw === "number") return STATUS_MAP[raw] ?? "Open";
  // Handle string
  if (typeof raw === "string") {
    const found = STATUS_MAP.find(
      (s) => s.toLowerCase() === raw.toLowerCase()
    );
    if (found) return found;
  }
  // Handle object with numeric key
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const idx = Number(Object.values(obj)[0]);
    if (!isNaN(idx) && idx >= 0 && idx < STATUS_MAP.length)
      return STATUS_MAP[idx];
  }
  return "Open";
}

function parseGame(raw: Record<string, unknown>): Game {
  return {
    player1: String(raw.player1 ?? ""),
    player2: raw.player2 ? String(raw.player2) : null,
    wager: toBigInt(raw.wager),
    token: String(raw.token ?? ""),
    commit1: toHex(raw.commit1),
    commit2: raw.commit2 ? toHex(raw.commit2) : null,
    move1: raw.move1 != null ? Number(raw.move1) : null,
    move2: raw.move2 != null ? Number(raw.move2) : null,
    status: parseGameStatus(raw.status),
    deadline: toBigInt(raw.deadline),
    timeout: toBigInt(raw.timeout),
  };
}

// ── Contract Calls ──
export async function getGame(gameId: number): Promise<Game> {
  const raw = (await readContract(CONTRACT_ADDRESS, "get_game", [
    toScValU64(gameId),
  ])) as Record<string, unknown>;
  return parseGame(raw);
}

export async function createGame(
  wager: string,
  move: number,
  timeoutSecs: number
): Promise<{ gameId: number; hash: string; salt: Uint8Array }> {
  const player = await ensureWalletConnected();
  const salt = generateSalt();
  const hash = await computeCommitHash(move, salt);

  const args = [
    toScValAddress(player),
    toScValI128(wager),
    toScValAddress(TOKEN_ADDRESS),
    toScValBytes(hash),
    toScValU64(BigInt(timeoutSecs)),
  ];
  const { hash: txHash, returnValue } = await writeContract(
    CONTRACT_ADDRESS,
    "create_game",
    args,
    player
  );

  const gameId = Number(returnValue ?? 0);
  storeSecret(gameId, move, salt);
  return { gameId, hash: txHash, salt };
}

export async function joinGame(
  gameId: number,
  move: number
): Promise<{ hash: string; salt: Uint8Array }> {
  const player = await ensureWalletConnected();
  const salt = generateSalt();
  const hash = await computeCommitHash(move, salt);

  const args = [
    toScValAddress(player),
    toScValU64(gameId),
    toScValBytes(hash),
  ];
  const { hash: txHash } = await writeContract(
    CONTRACT_ADDRESS,
    "join_game",
    args,
    player
  );
  storeSecret(gameId, move, salt);
  return { hash: txHash, salt };
}

export async function revealMove(
  gameId: number,
  move: number,
  salt: Uint8Array
): Promise<void> {
  const player = await ensureWalletConnected();
  const args = [
    toScValAddress(player),
    toScValU64(gameId),
    toScValU32(move),
    toScValBytesRaw(salt),
  ];
  await writeContract(CONTRACT_ADDRESS, "reveal_move", args, player);
}

export async function claimTimeout(gameId: number): Promise<void> {
  const player = await ensureWalletConnected();
  const args = [toScValU64(gameId), toScValAddress(player)];
  await writeContract(CONTRACT_ADDRESS, "claim_timeout", args, player);
}

export async function cancelGame(gameId: number): Promise<void> {
  const player = await ensureWalletConnected();
  const args = [toScValU64(gameId), toScValAddress(player)];
  await writeContract(CONTRACT_ADDRESS, "cancel_game", args, player);
}

// ── Helpers ──
export const MOVE_NAMES = ["Rock", "Paper", "Scissors"] as const;
export const MOVE_EMOJI = ["✊", "✋", "✌️"] as const;
export const MOVE_SHORT = ["R", "P", "S"] as const;

export function formatXlm(amount: bigint): string {
  return (Number(amount) / 10_000_000).toFixed(7);
}

export function isDeadlinePassed(deadline: bigint): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now > Number(deadline);
}
