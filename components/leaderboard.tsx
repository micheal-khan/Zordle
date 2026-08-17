"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Medal, Trophy } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Leader = {
  user_id: string;
  username: string;
  display_name: string;
  played: number;
  wins: number;
  misses: number;
  current_streak: number;
  max_streak: number;
  total_guesses: number;
};

export function Leaderboard({ user }: { user: User }) {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("player_stats")
      .select("user_id,username,display_name,played,wins,misses,current_streak,max_streak,total_guesses")
      .order("wins", { ascending: false })
      .order("max_streak", { ascending: false })
      .order("total_guesses", { ascending: true })
      .limit(50);
    if (error) setNotice(error.message);
    setLeaders((data ?? []) as Leader[]);
    setLoading(false);
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  return <div className="leaderboard-panel">
    <p className="eyebrow">ZORDLE COMMUNITY</p>
    <h2>Leaderboard</h2>
    <p className="modal-lead">Ranked by puzzles solved, then best streak. Accuracy breaks the tie.</p>
    {loading ? <div className="panel-loading">Counting clever minds…</div> : notice ? <p className="form-notice">{notice}</p> : <>
      <div className="leaderboard-head"><span>PLAYER</span><span>SOLVED</span><span>WIN %</span><span>STREAK</span><span>AVG.</span></div>
      <div className="leaderboard-list">
        {leaders.map((leader, index) => {
          const winRate = leader.played ? Math.round(leader.wins / leader.played * 100) : 0;
          const average = leader.wins ? (leader.total_guesses / leader.wins).toFixed(1) : "—";
          return <div className={`leader-row ${leader.user_id === user.id ? "is-you" : ""}`} key={leader.user_id}>
            <span className={`rank rank-${index + 1}`}>{index < 3 ? <Medal /> : index + 1}</span>
            <span className="leader-player"><i>{leader.display_name.slice(0, 1).toUpperCase()}</i><span><strong>{leader.display_name}{leader.user_id === user.id ? " (You)" : ""}</strong><small>@{leader.username}</small></span></span>
            <strong>{leader.wins}</strong><span>{winRate}%</span><span>{leader.current_streak}<small> / {leader.max_streak} best</small></span><span>{average}</span>
          </div>;
        })}
        {!leaders.length && <div className="empty-leaderboard"><Trophy /><strong>The first place is waiting.</strong><span>Complete today’s puzzle to claim it.</span></div>}
      </div>
      <p className="leaderboard-note">Only your public display name and aggregate scores appear here. Individual guesses remain private.</p>
    </>}
  </div>;
}
