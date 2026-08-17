"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CalendarDays, Flame, LogOut, Medal } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Profile = { id: string; username: string; display_name: string; created_at: string };
type Result = { puzzle_date: string; won: boolean; attempts: number };
type PlayerStats = { played: number; wins: number; misses: number; current_streak: number; max_streak: number; total_guesses: number };

export function PlayerProfile({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const [profileResponse, resultsResponse, statsResponse] = await Promise.all([
      supabase.from("profiles").select("id,username,display_name,created_at").eq("id", user.id).single(),
      supabase.from("game_results").select("puzzle_date,won,attempts").eq("user_id", user.id).order("puzzle_date", { ascending: true }),
      supabase.from("player_stats").select("played,wins,misses,current_streak,max_streak,total_guesses").eq("user_id", user.id).single(),
    ]);
    if (profileResponse.error) setNotice(profileResponse.error.message);
    if (profileResponse.data) {
      const nextProfile = profileResponse.data as Profile;
      setProfile(nextProfile);
      setDisplayName(nextProfile.display_name);
      setUsername(nextProfile.username);
    }
    setResults((resultsResponse.data ?? []) as Result[]);
    setStats((statsResponse.data as PlayerStats | null) ?? null);
    setLoading(false);
  }, [user.id]);

  useEffect(() => { void Promise.resolve().then(loadProfile); }, [loadProfile]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setNotice("Username must be 3–24 lowercase letters, numbers, or underscores.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSaving(true);
    setNotice("");
    const { error } = await supabase.from("profiles").update({ username: cleanUsername, display_name: displayName.trim() }).eq("id", user.id);
    setSaving(false);
    if (error) setNotice(error.code === "23505" ? "That username is already taken." : error.message);
    else { setNotice("Profile updated."); void loadProfile(); }
  };

  const winRate = stats?.played ? Math.round(stats.wins / stats.played * 100) : 0;
  const average = stats?.wins ? (stats.total_guesses / stats.wins).toFixed(1) : "—";

  return <div className="profile-panel">
    <p className="eyebrow">PLAYER PROFILE</p>
    <div className="profile-hero">
      <span className="profile-avatar">{(profile?.display_name || user.email || "Z").slice(0, 1).toUpperCase()}</span>
      <div><h2>{profile?.display_name || "Your Zordle journey"}</h2><p>{profile ? `@${profile.username}` : user.email}</p></div>
    </div>

    {loading ? <div className="panel-loading">Gathering your victories…</div> : <>
      <div className="profile-stat-grid">
        <ProfileStat value={stats?.wins ?? 0} label="Solved" icon={<Medal />} />
        <ProfileStat value={stats?.misses ?? 0} label="Missed" />
        <ProfileStat value={`${winRate}%`} label="Win rate" />
        <ProfileStat value={stats?.current_streak ?? 0} label="Current streak" icon={<Flame />} />
        <ProfileStat value={stats?.max_streak ?? 0} label="Best streak" />
        <ProfileStat value={average} label="Avg. guesses" />
      </div>

      <div className="calendar-section">
        <div className="section-heading"><div><CalendarDays /><span><strong>Your year in words</strong><small>{results.length} daily puzzles recorded</small></span></div><span className="calendar-year">RECENT ACTIVITY</span></div>
        <ActivityCalendar results={results} />
      </div>

      <form className="profile-form" onSubmit={saveProfile}>
        <h3>PUBLIC PROFILE</h3>
        <div className="profile-fields">
          <label>Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required /></label>
          <label>Username<div className="username-field"><span>@</span><input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} required /></div></label>
        </div>
        {notice && <p className="form-notice" role="status">{notice}</p>}
        <div className="profile-actions"><button className="secondary-button signout-button" type="button" onClick={onSignOut}><LogOut /> SIGN OUT</button><button className="primary-button" disabled={saving}>{saving ? "SAVING…" : "SAVE PROFILE"}</button></div>
      </form>
    </>}
  </div>;
}

function ProfileStat({ value, label, icon }: { value: string | number; label: string; icon?: React.ReactNode }) {
  return <div><span className="profile-stat-value">{icon}{value}</span><small>{label}</small></div>;
}

function ActivityCalendar({ results }: { results: Result[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { days, monthLabels } = useMemo(() => {
    const byDate = new Map(results.map((result) => [result.puzzle_date, result]));
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 364);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const calendarDays: Array<{ date: string; result?: Result; future: boolean }> = [];
    const cursor = new Date(start);
    while (calendarDays.length < 371) {
      const date = cursor.toISOString().slice(0, 10);
      calendarDays.push({ date, result: byDate.get(date), future: cursor > end });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const labels = Array.from({ length: 53 }, (_, week) => {
      const first = new Date(`${calendarDays[week * 7].date}T00:00:00Z`);
      const last = new Date(`${calendarDays[week * 7 + 6].date}T00:00:00Z`);
      return first.getUTCMonth() !== last.getUTCMonth() || first.getUTCDate() <= 7
        ? last.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
        : "";
    });
    return { days: calendarDays, monthLabels: labels };
  }, [results]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [days]);

  return <>
    <div className="calendar-scroll" ref={scrollRef} tabIndex={0} aria-label="Daily puzzle activity for the last twelve months">
      <div className="calendar-months">{monthLabels.map((label, index) => <span key={index}>{label}</span>)}</div>
      <div className="calendar-layout">
        <div className="calendar-weekdays"><span>Mon</span><span>Wed</span><span>Fri</span></div>
        <div className="activity-calendar">
          {days.map(({ date, result, future }) => {
            const level = !result ? "empty" : !result.won ? "missed" : result.attempts <= 2 ? "level-4" : result.attempts === 3 ? "level-3" : result.attempts === 4 ? "level-2" : "level-1";
            const title = future ? date : result ? `${date}: ${result.won ? `Solved in ${result.attempts}` : "Missed"}` : `${date}: No puzzle recorded`;
            return <i className={`${level} ${future ? "future" : ""}`} title={title} aria-label={title} key={date} />;
          })}
        </div>
      </div>
    </div>
    <div className="calendar-legend"><span>Missed</span><i className="missed" /><span>Less</span><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><span>Fewer guesses</span></div>
  </>;
}
