"use client";

import { useState, useEffect, useCallback } from "react";
import { ensureWalletConnected, getAddressSafe } from "@/lib/stellar";
import {
  CONTRACT_ADDRESS,
  createGame,
  joinGame,
  revealMove,
  claimTimeout,
  cancelGame,
  getGame,
  getSecret,
  MOVE_NAMES,
  MOVE_EMOJI,
  formatXlm,
  isDeadlinePassed,
  type Game,
} from "@/hooks/contract";

function Toast({
  msg,
  kind,
  onClose,
}: {
  msg: string;
  kind: "ok" | "err";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl px-5 py-3 text-sm font-medium shadow-2xl ${
        kind === "ok" ? "bg-emerald-600" : "bg-red-600"
      } text-white`}
    >
      {msg}
    </div>
  );
}

function MoveButton({
  idx,
  selected,
  onClick,
}: {
  idx: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 px-5 py-3 text-lg font-bold transition-all ${
        selected
          ? "border-blue-500 bg-blue-500/20 text-blue-400"
          : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500"
      }`}
    >
      <span className="text-3xl">{MOVE_EMOJI[idx]}</span>
      <span className="text-xs">{MOVE_NAMES[idx]}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Open: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Committed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${colors[status] ?? "bg-gray-700 text-gray-300"}`}
    >
      {status}
    </span>
  );
}

export default function Game() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "lookup">("create");

  const [cMove, setCMove] = useState<number | null>(null);
  const [cWager, setCWager] = useState("100");
  const [cTimeout, setCTimeout] = useState("3600");
  const [cLoading, setCLoading] = useState(false);

  const [lookupId, setLookupId] = useState("");
  const [game, setGame] = useState<Game | null>(null);
  const [lookupErr, setLookupErr] = useState("");

  const [jMove, setJMove] = useState<number | null>(null);
  const [jLoading, setJLoading] = useState(false);

  const [rMove, setRMove] = useState<number | null>(null);
  const [rSalt, setRSalt] = useState("");
  const [rLoading, setRLoading] = useState(false);

  const [toast, setToast] = useState<{
    msg: string;
    kind: "ok" | "err";
  } | null>(null);
  const showToast = (msg: string, kind: "ok" | "err" = "ok") =>
    setToast({ msg, kind });

  const connect = useCallback(async () => {
    try {
      const addr = await ensureWalletConnected();
      setWallet(addr);
      showToast("Wallet connected");
    } catch (e: unknown) {
      showToast(String(e), "err");
    }
  }, []);

  useEffect(() => {
    getAddressSafe().then(setWallet);
  }, []);

  const refreshGame = useCallback(
    async (id?: number) => {
      const gid = id ?? parseInt(lookupId);
      if (isNaN(gid)) return showToast("Invalid game ID", "err");
      try {
        const g = await getGame(gid);
        setGame(g);
        setLookupErr("");
        const secret = getSecret(gid);
        if (secret) {
          setRMove(secret.move);
          setRSalt(
            Array.from(secret.salt)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
          );
        }
      } catch (e: unknown) {
        setGame(null);
        setLookupErr(String(e));
      }
    },
    [lookupId]
  );

  const handleCreate = async () => {
    if (cMove === null) return showToast("Pick a move", "err");
    if (!CONTRACT_ADDRESS)
      return showToast("Set NEXT_PUBLIC_CONTRACT_ADDRESS env var", "err");
    setCLoading(true);
    try {
      const { gameId } = await createGame(
        cWager,
        "CDLZFC3SYJ6D5T5BBKVFRQPLDIISEL5BFRL5KZTBW3G5XJZVIKU5ESGS",
        cMove,
        parseInt(cTimeout) || 3600
      );
      showToast(`Game #${gameId} created! Share the ID with your opponent.`);
      setLookupId(String(gameId));
      setTab("lookup");
      await refreshGame(gameId);
    } catch (e: unknown) {
      showToast(String(e), "err");
    } finally {
      setCLoading(false);
    }
  };

  const handleJoin = async () => {
    if (jMove === null || !game) return showToast("Pick a move", "err");
    setJLoading(true);
    try {
      await joinGame(parseInt(lookupId), jMove);
      showToast("Joined! Both players are now committed.");
      await refreshGame();
    } catch (e: unknown) {
      showToast(String(e), "err");
    } finally {
      setJLoading(false);
    }
  };

  const handleReveal = async () => {
    if (rMove === null || !rSalt || !game)
      return showToast("Fill move + salt", "err");
    setRLoading(true);
    try {
      const saltBytes = Uint8Array.from(
        rSalt.match(/.{1,2}/g)!.map((h) => parseInt(h, 16))
      );
      await revealMove(parseInt(lookupId), rMove, saltBytes);
      showToast("Move revealed! Waiting for opponent...");
      await refreshGame();
    } catch (e: unknown) {
      showToast(String(e), "err");
    } finally {
      setRLoading(false);
    }
  };

  const handleClaimTimeout = async () => {
    try {
      await claimTimeout(parseInt(lookupId));
      showToast("Timeout claimed! Pot transferred.");
      await refreshGame();
    } catch (e: unknown) {
      showToast(String(e), "err");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelGame(parseInt(lookupId));
      showToast("Game cancelled, wager returned.");
      await refreshGame();
    } catch (e: unknown) {
      showToast(String(e), "err");
    }
  };

  useEffect(() => {
    if (!game || game.status === "Resolved") return;
    const id = setInterval(() => refreshGame(), 10000);
    return () => clearInterval(id);
  }, [game?.status, refreshGame]);

  const myAddr = wallet ?? "";
  const isP1 = game?.player1 === myAddr;
  const isP2 = game?.player2 === myAddr;
  const myRevealed = isP1 ? game?.move1 != null : game?.move2 != null;
  const theirRevealed = isP1 ? game?.move2 != null : game?.move1 != null;
  const deadlinePassed = game ? isDeadlinePassed(game.deadline) : false;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {toast && (
        <Toast
          msg={toast.msg}
          kind={toast.kind}
          onClose={() => setToast(null)}
        />
      )}

      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">
            {MOVE_EMOJI[0]}{MOVE_EMOJI[1]}{MOVE_EMOJI[2]} Trustless RPS
          </h1>
          {wallet ? (
            <span className="rounded-lg bg-gray-800 px-3 py-1.5 font-mono text-xs text-gray-400">
              {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </span>
          ) : (
            <button
              onClick={connect}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-blue-500"
            >
              Connect Freighter
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {!CONTRACT_ADDRESS && (
          <div className="mb-8 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
            Deploy the contract, then set{" "}
            <code className="rounded bg-yellow-500/20 px-1 font-mono">
              NEXT_PUBLIC_CONTRACT_ADDRESS
            </code>{" "}
            in your environment.
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8 flex gap-2">
          {(["create", "lookup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-gray-800 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t === "create" ? "Create Game" : "Join / View Game"}
            </button>
          ))}
        </div>

        {/* ── Create Tab ── */}
        {tab === "create" && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
            <h2 className="mb-6 text-lg font-bold">Create a New Game</h2>

            <label className="mb-2 block text-sm text-gray-400">
              Your Move
            </label>
            <div className="mb-6 flex gap-3">
              {[0, 1, 2].map((i) => (
                <MoveButton
                  key={i}
                  idx={i}
                  selected={cMove === i}
                  onClick={() => setCMove(i)}
                />
              ))}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Wager (in stroops)
                </label>
                <input
                  type="text"
                  value={cWager}
                  onChange={(e) => setCWager(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="10000000"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {formatXlm(BigInt(cWager || "0"))} XLM
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">
                  Timeout (seconds)
                </label>
                <input
                  type="text"
                  value={cTimeout}
                  onChange={(e) => setCTimeout(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="3600"
                />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={cLoading || !wallet}
              className="mt-4 w-full rounded-lg bg-blue-600 py-3 text-sm font-bold transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cLoading ? "Creating..." : "Create Game"}
            </button>
          </div>
        )}

        {/* ── Lookup Tab ── */}
        {tab === "lookup" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
              <h2 className="mb-4 text-lg font-bold">Look Up Game</h2>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={lookupId}
                  onChange={(e) => {
                    setLookupId(e.target.value);
                    setGame(null);
                    setLookupErr("");
                  }}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Game ID"
                  min="0"
                />
                <button
                  onClick={() => refreshGame()}
                  className="rounded-lg bg-gray-700 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-600"
                >
                  Load
                </button>
              </div>
              {lookupErr && (
                <p className="mt-2 text-sm text-red-400">{lookupErr}</p>
              )}
            </div>

            {/* Game Card */}
            {game && (
              <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-bold">Game #{lookupId}</h2>
                  <StatusBadge status={game.status} />
                </div>

                <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
                  <InfoRow label="Player 1" value={shortAddr(game.player1)} />
                  <InfoRow
                    label="Player 2"
                    value={game.player2 ? shortAddr(game.player2) : "Waiting..."}
                  />
                  <InfoRow
                    label="Wager"
                    value={`${formatXlm(game.wager)} XLM`}
                  />
                  <InfoRow
                    label="Deadline"
                    value={new Date(Number(game.deadline) * 1000).toLocaleString()}
                  />
                </div>

                {game.status === "Open" && game.player1 !== myAddr && (
                  <div className="border-t border-gray-800 pt-6">
                    <h3 className="mb-4 text-sm font-semibold text-gray-400">
                      Join this game
                    </h3>
                    <div className="mb-4 flex gap-3">
                      {[0, 1, 2].map((i) => (
                        <MoveButton
                          key={i}
                          idx={i}
                          selected={jMove === i}
                          onClick={() => setJMove(i)}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleJoin}
                      disabled={jLoading || !wallet}
                      className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {jLoading ? "Joining..." : "Join & Commit"}
                    </button>
                  </div>
                )}

                {game.status === "Open" &&
                  game.player1 === myAddr &&
                  deadlinePassed && (
                    <div className="border-t border-gray-800 pt-6">
                      <button
                        onClick={handleCancel}
                        className="w-full rounded-lg bg-red-600/80 py-3 text-sm font-bold transition-colors hover:bg-red-500"
                      >
                        Cancel & Refund (timeout)
                      </button>
                    </div>
                  )}

                {game.status === "Open" &&
                  game.player1 === myAddr &&
                  !deadlinePassed && (
                    <div className="border-t border-gray-800 pt-6 text-center text-sm text-gray-500">
                      Waiting for an opponent to join...
                    </div>
                  )}

                {game.status === "Committed" && (
                  <div className="border-t border-gray-800 pt-6">
                    <h3 className="mb-4 text-sm font-semibold text-gray-400">
                      Reveal your move
                    </h3>
                    {myRevealed ? (
                      <p className="mb-4 text-sm text-yellow-400">
                        You&apos;ve revealed. Waiting for opponent...
                      </p>
                    ) : (
                      <>
                        <div className="mb-3 flex gap-3">
                          {[0, 1, 2].map((i) => (
                            <MoveButton
                              key={i}
                              idx={i}
                              selected={rMove === i}
                              onClick={() => setRMove(i)}
                            />
                          ))}
                        </div>
                        <div className="mb-4">
                          <label className="mb-1 block text-xs text-gray-400">
                            Salt (hex)
                          </label>
                          <input
                            type="text"
                            value={rSalt}
                            onChange={(e) => setRSalt(e.target.value)}
                            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 font-mono text-xs focus:border-blue-500 focus:outline-none"
                            placeholder="Auto-filled from localStorage if you created/joined this browser"
                          />
                        </div>
                        <button
                          onClick={handleReveal}
                          disabled={rLoading || !wallet || !rSalt}
                          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {rLoading ? "Revealing..." : "Reveal Move"}
                        </button>
                      </>
                    )}

                    {deadlinePassed && !theirRevealed && myRevealed && (
                      <button
                        onClick={handleClaimTimeout}
                        className="mt-4 w-full rounded-lg bg-orange-600 py-3 text-sm font-bold transition-colors hover:bg-orange-500"
                      >
                        Claim Win (opponent timed out)
                      </button>
                    )}
                  </div>
                )}

                {game.status === "Resolved" && (
                  <div className="border-t border-gray-800 pt-6 text-center">
                    <p className="text-lg font-bold text-green-400">
                      Game Over
                    </p>
                    <p className="mt-2 text-sm text-gray-400">
                      Moves: {MOVE_NAMES[game.move1 ?? 0]} vs{" "}
                      {MOVE_NAMES[game.move2 ?? 0]}
                    </p>
                    {game.move1 != null && game.move2 != null && (
                      <ResultMessage m1={game.move1} m2={game.move2} me={isP1 ? 1 : isP2 ? 2 : 0} />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function ResultMessage({ m1, m2, me }: { m1: number; m2: number; me: number }) {
  if (m1 === m2) return <p className="text-sm text-gray-400">Draw - wagers refunded</p>;
  const p1Wins = (m1 + 1) % 3 !== m2;
  if (me === 0) return <p className="text-sm text-gray-400">Player 1 wins</p>;
  const iWon = (me === 1 && p1Wins) || (me === 2 && !p1Wins);
  return (
    <p className={`text-sm font-semibold ${iWon ? "text-green-400" : "text-red-400"}`}>
      {iWon ? "You won the pot!" : "Opponent won the pot."}
    </p>
  );
}
