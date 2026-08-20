"use client";

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

// ── Update this after deploying the contract ──
export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

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
  if (v instanceof Uint8Array) return Buffer.from(v).toString("hex");
  if (typeof v === "string") return v;
  return "";
}

function parseGame(raw: Record<string, unknown>): Game {
  const statusIdx =
    typeof raw.status === "number" ? raw.status : Number(raw.status ?? 0);
  return {
    player1: String(raw.player1 ?? ""),
    player2: raw.player2 ? String(raw.player2) : null,
    wager: toBigInt(raw.wager),
    token: String(raw.token ?? ""),
    commit1: toHex(raw.commit1),
    commit2: raw.commit2 ? toHex(raw.commit2) : null,
    move1: raw.move1 != null ? Number(raw.move1) : null,
    move2: raw.move2 != null ? Number(raw.move2) : null,
    status: STATUS_MAP[statusIdx] ?? "Open",
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
  token: string,
  move: number,
  timeoutSecs: number
): Promise<{ gameId: number; hash: string; salt: Uint8Array }> {
  const player = await ensureWalletConnected();
  const salt = generateSalt();
  const hash = await computeCommitHash(move, salt);

  const args = [
    toScValAddress(player),
    toScValI128(wager),
    toScValAddress(token),
    toScValBytes(hash),
    toScValU64(BigInt(timeoutSecs)),
  ];
  await writeContract(CONTRACT_ADDRESS, "create_game", args, player);

  // Find the game we just created by scanning backwards
  let gameId = 0;
  for (let i = 0; i < 200; i++) {
    try {
      const g = await getGame(i);
      if (g.player1 === player && g.status === "Open" && g.wager === toBigInt(wager)) {
        gameId = i;
        break;
      }
    } catch {
      break;
    }
  }

  storeSecret(gameId, move, salt);
  return { gameId, hash, salt };
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
  await writeContract(CONTRACT_ADDRESS, "join_game", args, player);
  storeSecret(gameId, move, salt);
  return { hash, salt };
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
