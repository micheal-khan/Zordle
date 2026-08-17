"use client";

import { useState } from "react";
import { Check, LockKeyhole, Sparkles } from "@/components/icons";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setNotice("Supabase is not configured yet. Add the public URL and publishable key, then restart the app.");
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setNotice("Please enter the name you would like other players to see.");
      return;
    }
    setLoading(true);
    setNotice("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
    setLoading(false);
    if (result.error) {
      setNotice(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setNotice("Your account is ready. Check your email to confirm it, then sign in.");
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark">Z</span><strong>Zordle</strong></div>
        <div className="auth-copy">
          <p className="eyebrow align-left">YOUR DAILY WORD RITUAL</p>
          <h1>One word.<br /><em>Your</em> story.</h1>
          <p>Play the daily puzzle, protect your streak, and watch a year of small victories grow.</p>
          <div className="auth-benefits">
            <span><Check /> One beautifully crafted puzzle every day</span>
            <span><Check /> A private history that follows you everywhere</span>
            <span><Check /> Friendly rankings with the Zordle community</span>
          </div>
        </div>
        <CalendarPreview />
        <p className="auth-quote">“A five-minute pause for curious minds.”</p>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <div className="auth-icon"><LockKeyhole /></div>
          <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN THE RITUAL"}</p>
          <h2>{mode === "login" ? "Continue your streak" : "Create your player profile"}</h2>
          <p className="auth-subtitle">{mode === "login" ? "Sign in to unlock today’s puzzle." : "Your first Zordle is waiting."}</p>

          {!isSupabaseConfigured && <p className="form-notice">Supabase keys are missing from the current environment.</p>}
          <form onSubmit={submit}>
            {mode === "signup" && <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} autoComplete="name" placeholder="How players will know you" required /></label>}
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="At least 8 characters" required /></label>
            {notice && <p className="form-notice" role="status">{notice}</p>}
            <button className="primary-button full auth-submit" disabled={loading || !isSupabaseConfigured}>{loading ? "OPENING ZORDLE…" : mode === "login" ? "SIGN IN & PLAY" : "CREATE ACCOUNT"}</button>
          </form>
          <button className="text-button auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setNotice(""); }}>
            {mode === "login" ? "New to Zordle? Create an account" : "Already have a profile? Sign in"}
          </button>
          <p className="auth-privacy"><Sparkles /> Your results are yours. We only share your public ranking.</p>
        </div>
      </section>
    </main>
  );
}

function CalendarPreview() {
  const levels = [0, 1, 0, 2, 3, 0, 0, 1, 4, 2, 0, 3, 2, 1, 0, 0, 2, 4, 3, 0, 1, 3, 0, 2, 4, 4, 0, 1, 2, 3, 0, 0, 4, 2, 1, 0, 3, 4, 2, 0, 1, 2, 0, 3, 4, 2, 1, 0, 2, 3, 4, 0, 1, 3, 2, 0, 4, 4, 2, 1, 0, 3, 2, 4, 1, 0, 2, 3, 4, 0, 1, 4, 3, 2, 0, 2, 4, 1, 3, 0, 0, 2, 3, 4, 1, 0, 3, 4, 2, 1, 0];
  return <div className="auth-calendar" aria-hidden="true">{levels.map((level, index) => <i className={`level-${level}`} key={index} />)}</div>;
}
