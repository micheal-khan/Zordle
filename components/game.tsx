"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { BarChart3, CalendarDays, CircleHelp, Delete, Lightbulb, Moon, Settings, Sun, Trophy, UserRound, X } from "@/components/icons";
import { AuthGate } from "@/components/auth-gate";
import { Leaderboard } from "@/components/leaderboard";
import { PlayerProfile } from "@/components/player-profile";
import { authenticatedFetch, getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Evaluation, TileState } from "@/lib/game";

type Guess = { word: string; evaluation: Evaluation };
type GameStatus = "playing" | "won" | "lost";
type SavedGame = { date: string; guesses: Guess[]; status: GameStatus; answer?: string };
type LocalStats = { played: number; wins: number; currentStreak: number; maxStreak: number; distribution: number[]; lastWinDate?: string };

const ROWS = 6;
const COLS = 5;
const KEYS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const EMPTY_STATS: LocalStats = { played: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: [0, 0, 0, 0, 0, 0] };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a?: string, b?: string) {
  if (!a || !b) return Infinity;
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000);
}

function loadSavedGame(userId: string): SavedGame {
  if (typeof window === "undefined") return { date: today(), guesses: [], status: "playing" };
  try {
    const parsed = JSON.parse(localStorage.getItem(`zordle:game:${userId}:${today()}`) || "null") as SavedGame | null;
    return parsed?.date === today() ? parsed : { date: today(), guesses: [], status: "playing" };
  } catch {
    return { date: today(), guesses: [], status: "playing" };
  }
}

function loadStats(userId: string): LocalStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    return { ...EMPTY_STATS, ...(JSON.parse(localStorage.getItem(`zordle:stats:${userId}`) || "null") || {}) };
  } catch {
    return EMPTY_STATS;
  }
}

export function Game() {
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [game, setGame] = useState<SavedGame>({ date: today(), guesses: [], status: "playing" });
  const [current, setCurrent] = useState("");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [modal, setModal] = useState<"help" | "stats" | "settings" | "profile" | "leaderboard" | null>(null);
  const [stats, setStats] = useState<LocalStats>(EMPTY_STATS);
  const [puzzleNo, setPuzzleNo] = useState(1000);
  const [user, setUser] = useState<User | null>(null);
  const [hint, setHint] = useState("");
  const [hintBusy, setHintBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void Promise.resolve().then(async () => {
      if (!active) return;
      const savedTheme = localStorage.getItem("zordle:theme") === "dark" ? "dark" : "light";
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
      setMounted(true);
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setAuthReady(true); return; }
      const { data } = await supabase.auth.getUser();
      if (active) {
        setUser(data.user);
        if (data.user) {
          setGame(loadSavedGame(data.user.id));
          setStats(loadStats(data.user.id));
          authenticatedFetch("/api/game").then((response) => response.json()).then((gameData: { puzzleNumber?: number }) => { if (gameData.puzzleNumber) setPuzzleNo(gameData.puzzleNumber); }).catch(() => undefined);
          if (!localStorage.getItem("zordle:welcomed")) setModal("help");
        }
        setAuthReady(true);
      }
      const { data: listener } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        setAuthReady(true);
        if (nextUser) {
          setGame(loadSavedGame(nextUser.id));
          setStats(loadStats(nextUser.id));
          authenticatedFetch("/api/game").then((response) => response.json()).then((gameData: { puzzleNumber?: number }) => { if (gameData.puzzleNumber) setPuzzleNo(gameData.puzzleNumber); }).catch(() => undefined);
          if (!localStorage.getItem("zordle:welcomed")) setModal("help");
        } else {
          setModal(null);
        }
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    localStorage.setItem(`zordle:game:${user.id}:${game.date}`, JSON.stringify(game));
  }, [game, mounted, user]);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    void Promise.all([
      supabase.from("player_stats").select("played,wins,current_streak,max_streak").eq("user_id", user.id).single(),
      supabase.from("game_results").select("won,attempts,puzzle_date").eq("user_id", user.id),
    ]).then(([statsResponse, resultsResponse]) => {
      if (!statsResponse.data) return;
      const results = resultsResponse.data ?? [];
      const distribution = [0, 0, 0, 0, 0, 0];
      results.forEach((result) => { if (result.won) distribution[result.attempts - 1] += 1; });
      const lastWinDate = results.filter((result) => result.won).map((result) => result.puzzle_date).sort().at(-1);
      const cloudStats: LocalStats = {
        played: statsResponse.data.played,
        wins: statsResponse.data.wins,
        currentStreak: statsResponse.data.current_streak,
        maxStreak: statsResponse.data.max_streak,
        distribution,
        lastWinDate,
      };
      setStats(cloudStats);
      localStorage.setItem(`zordle:stats:${user.id}`, JSON.stringify(cloudStats));
    });
  }, [user]);

  const keyStates = useMemo(() => {
    const rank: Record<TileState, number> = { empty: 0, filled: 0, absent: 1, present: 2, correct: 3 };
    const result: Record<string, TileState> = {};
    game.guesses.forEach((guess) => guess.word.split("").forEach((letter, index) => {
      const next = guess.evaluation[index];
      if (!result[letter] || rank[next] > rank[result[letter]]) result[letter] = next;
    }));
    return result;
  }, [game.guesses]);

  const finishGame = useCallback(async (nextGame: SavedGame, won: boolean) => {
    if (!user) return;
    const previous = loadStats(user.id);
    const alreadyRecorded = localStorage.getItem(`zordle:recorded:${user.id}:${today()}`) === "1";
    if (!alreadyRecorded) {
      const streak = won ? (daysBetween(previous.lastWinDate, today()) === 1 ? previous.currentStreak + 1 : 1) : 0;
      const nextStats: LocalStats = {
        played: previous.played + 1,
        wins: previous.wins + (won ? 1 : 0),
        currentStreak: streak,
        maxStreak: Math.max(previous.maxStreak, streak),
        distribution: previous.distribution.map((value, index) => value + (won && index === nextGame.guesses.length - 1 ? 1 : 0)),
        lastWinDate: won ? today() : previous.lastWinDate,
      };
      setStats(nextStats);
      localStorage.setItem(`zordle:stats:${user.id}`, JSON.stringify(nextStats));

      const supabase = getSupabaseBrowserClient();
      if (supabase && user) {
        const { error } = await supabase.from("game_results").upsert({
          user_id: user.id,
          puzzle_date: today(),
          won,
          attempts: nextGame.guesses.length,
          guesses: nextGame.guesses.map((guess) => guess.word),
        }, { onConflict: "user_id,puzzle_date" });
        if (error) setMessage(`Solved, but cloud sync needs attention: ${error.message}`);
        else localStorage.setItem(`zordle:recorded:${user.id}:${today()}`, "1");
      }
    }
    window.setTimeout(() => setModal("stats"), 900);
  }, [user]);

  const submitGuess = useCallback(async () => {
    if (busy || game.status !== "playing") return;
    if (current.length !== COLS) {
      setMessage("Not enough letters"); setShake(true); window.setTimeout(() => setShake(false), 450); return;
    }
    setBusy(true);
    try {
      const response = await authenticatedFetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess: current, attempt: game.guesses.length + 1 }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Try another word"); setShake(true); window.setTimeout(() => setShake(false), 450); return;
      }
      const nextGuesses = [...game.guesses, { word: current, evaluation: data.evaluation as Evaluation }];
      const status: GameStatus = data.won ? "won" : nextGuesses.length === ROWS ? "lost" : "playing";
      const nextGame = { ...game, guesses: nextGuesses, status, answer: data.answer };
      setGame(nextGame);
      setCurrent("");
      if (status !== "playing") {
        setMessage(status === "won" ? ["Brilliant!", "Impressive!", "Beautiful!", "Magnificent!", "Phew!", "Great solve!"][nextGuesses.length - 1] : `The word was ${String(data.answer).toUpperCase()}`);
        await finishGame(nextGame, status === "won");
      } else setMessage("");
    } catch {
      setMessage("Connection hiccup — try again");
    } finally {
      setBusy(false);
    }
  }, [busy, current, finishGame, game]);

  const handleKey = useCallback((key: string) => {
    if (modal || game.status !== "playing" || busy) return;
    if (key === "enter") { void submitGuess(); return; }
    if (key === "backspace") { setCurrent((value) => value.slice(0, -1)); return; }
    if (/^[a-z]$/.test(key)) setCurrent((value) => value.length < COLS ? value + key : value);
  }, [busy, game.status, modal, submitGuess]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKey(event.key.toLowerCase());
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleKey]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem("zordle:theme", next);
  };

  const getHint = async () => {
    setHintBusy(true);
    try {
      const response = await authenticatedFetch("/api/hint", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guesses: game.guesses.map((guess) => guess.word) }) });
      const data = await response.json(); setHint(data.hint);
    } finally { setHintBusy(false); }
  };

  const share = async () => {
    const squares = game.guesses.map((guess) => guess.evaluation.map((state) => state === "correct" ? "🟩" : state === "present" ? "🟨" : "⬛").join("")).join("\n");
    const result = game.status === "won" ? game.guesses.length : "X";
    await navigator.clipboard.writeText(`Zordle #${puzzleNo} ${result}/6\n\n${squares}\n\nzordle.app`);
    setMessage("Copied results to clipboard");
  };

  const signOut = async () => {
    await getSupabaseBrowserClient()?.auth.signOut();
    setUser(null);
    setModal(null);
  };

  if (!mounted || !authReady) return <div className="auth-loading"><span className="brand-mark">Z</span><p>Preparing today&apos;s puzzle…</p></div>;
  if (!user) return <AuthGate />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="header-actions left">
          <button className="icon-button" aria-label="How to play" onClick={() => setModal("help")}><CircleHelp /></button>
        </div>
        <div className="brand-lockup"><span className="brand-mark">Z</span><h1>Zordle</h1><span className="edition">DAILY</span></div>
        <div className="header-actions">
          <button className="icon-button" aria-label="Statistics" onClick={() => setModal("stats")}><BarChart3 /></button>
          <button className="icon-button" aria-label="Leaderboard" onClick={() => setModal("leaderboard")}><Trophy /></button>
          <button className="icon-button" aria-label="Settings" onClick={() => setModal("settings")}><Settings /></button>
          <button className="avatar-button" aria-label="Player profile" onClick={() => setModal("profile")}><UserRound /></button>
        </div>
      </header>

      <section className="game-stage">
        <div className="game-card">
          <div className="puzzle-label"><span>TODAY · #{puzzleNo}</span><i /><span>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
          <div className="message-slot" role="status">{message && <span>{message}</span>}</div>
          <div className="board" aria-label="Guess board">
            {Array.from({ length: ROWS }, (_, row) => {
              const submitted = game.guesses[row];
              const letters = submitted?.word ?? (row === game.guesses.length ? current : "");
              return <div className={`board-row ${row === game.guesses.length && shake ? "shake" : ""}`} key={row}>
                {Array.from({ length: COLS }, (_, col) => {
                  const letter = letters[col] ?? "";
                  const state: TileState = submitted ? submitted.evaluation[col] : letter ? "filled" : "empty";
                  return <div className={`tile ${state} ${submitted ? "reveal" : ""}`} style={{ animationDelay: submitted ? `${col * 90}ms` : undefined }} key={col} aria-label={letter ? `${letter}, ${state}` : "empty"}><span>{letter}</span></div>;
                })}
              </div>;
            })}
          </div>

          <div className="hint-wrap">
            {game.guesses.length >= 2 && game.status === "playing" && (hint ? <p className="hint-text"><Lightbulb /> {hint}</p> : <button className="hint-button" onClick={getHint} disabled={hintBusy}><Lightbulb /> {hintBusy ? "Thinking…" : "Need a gentle nudge?"}</button>)}
          </div>
        </div>

        <div className="keyboard" aria-label="On-screen keyboard">
          {KEYS.map((row, rowIndex) => <div className="key-row" key={row}>
            {rowIndex === 2 && <button className="key wide" onClick={() => handleKey("enter")}>ENTER</button>}
            {row.split("").map((letter) => <button className={`key ${keyStates[letter] ?? ""}`} aria-label={letter} key={letter} onClick={() => handleKey(letter)}>{letter}</button>)}
            {rowIndex === 2 && <button className="key wide delete" aria-label="Delete" onClick={() => handleKey("backspace")}><Delete /></button>}
          </div>)}
        </div>
      </section>

      <footer><span>A quiet ritual for curious minds.</span><span>New puzzle every midnight UTC</span></footer>

      <nav className="mobile-dock" aria-label="Main navigation">
        <button className={!modal ? "active" : ""} onClick={() => setModal(null)}><CalendarDays /><span>Today</span></button>
        <button className={modal === "stats" ? "active" : ""} onClick={() => setModal("stats")}><BarChart3 /><span>Stats</span></button>
        <button className={modal === "leaderboard" ? "active" : ""} onClick={() => setModal("leaderboard")}><Trophy /><span>Leaders</span></button>
        <button className={modal === "profile" ? "active" : ""} onClick={() => setModal("profile")}><UserRound /><span>Profile</span></button>
      </nav>

      {modal && <Modal wide={modal === "profile" || modal === "leaderboard"} onClose={() => setModal(null)}>
        {modal === "help" && <Help onDone={() => { localStorage.setItem("zordle:welcomed", "1"); setModal(null); }} />}
        {modal === "stats" && <Stats stats={stats} status={game.status} onShare={share} />}
        {modal === "settings" && <SettingsPanel theme={theme} onTheme={toggleTheme} configured={isSupabaseConfigured} />}
        {modal === "profile" && <PlayerProfile user={user} onSignOut={signOut} />}
        {modal === "leaderboard" && <Leaderboard user={user} />}
      </Modal>}
    </main>
  );
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true"><span className="sheet-handle" aria-hidden="true" /><button className="modal-close" aria-label="Close" onClick={onClose}><X /></button>{children}</section>
  </div>;
}

function Help({ onDone }: { onDone: () => void }) {
  return <div><p className="eyebrow">WELCOME TO</p><h2 className="modal-title">Zordle</h2><p className="modal-lead">Guess the five-letter word in six tries. Each guess reveals how close you are.</p>
    <div className="examples">
      <Example word="CRAFT" active={0} state="correct" /><p><strong>C</strong> is in the word and in the correct spot.</p>
      <Example word="PLANT" active={1} state="present" /><p><strong>L</strong> is in the word but in the wrong spot.</p>
      <Example word="VIVID" active={3} state="absent" /><p><strong>I</strong> is not in the word in any spot.</p>
    </div><div className="rule"><Lightbulb /><span>A new Zordle appears every day. Your progress stays private and syncs when you sign in.</span></div><button className="primary-button full" onClick={onDone}>START PLAYING</button>
  </div>;
}

function Example({ word, active, state }: { word: string; active: number; state: TileState }) {
  return <div className="example-row">{word.split("").map((letter, index) => <span className={index === active ? state : ""} key={index}>{letter}</span>)}</div>;
}

function Stats({ stats, status, onShare }: { stats: LocalStats; status: GameStatus; onShare: () => void }) {
  const winPct = stats.played ? Math.round(stats.wins / stats.played * 100) : 0;
  const max = Math.max(1, ...stats.distribution);
  return <div><p className="eyebrow">YOUR JOURNEY</p><h2>Statistics</h2><div className="stat-grid"><Stat value={stats.played} label="Played" /><Stat value={winPct} label="Win %" /><Stat value={stats.currentStreak} label="Current streak" /><Stat value={stats.maxStreak} label="Best streak" /></div>
    <h3>GUESS DISTRIBUTION</h3><div className="distribution">{stats.distribution.map((value, index) => <div className="bar-row" key={index}><b>{index + 1}</b><span style={{ width: `${Math.max(8, value / max * 100)}%` }}>{value}</span></div>)}</div>
    {status !== "playing" && <button className="primary-button full" onClick={onShare}>SHARE RESULT</button>}
    {status === "playing" && <p className="soft-note">Complete today&apos;s puzzle to unlock sharing.</p>}
  </div>;
}

function Stat({ value, label }: { value: number; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }

function SettingsPanel({ theme, onTheme, configured }: { theme: string; onTheme: () => void; configured: boolean }) {
  return <div><p className="eyebrow">MAKE IT YOURS</p><h2>Settings</h2><button className="setting-row" onClick={onTheme}><span><strong>Appearance</strong><small>Switch between light and dark</small></span><span className="theme-pill">{theme === "light" ? <Sun /> : <Moon />}{theme}</span></button>
    <div className="setting-row static"><span><strong>Cloud progress</strong><small>{configured ? "Supabase is ready — sign in to sync" : "Add Supabase keys to enable sync"}</small></span><span className={`status-dot ${configured ? "ready" : ""}`} /></div>
    <p className="soft-note">Zordle uses a public-domain word source and keeps the answer on the server.</p></div>;
}
