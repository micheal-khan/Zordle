import { COMMON_GUESSES, evaluateGuess, getDailyAnswer, puzzleDate, puzzleNumber } from "@/lib/game";
import { getRequestUser, unauthorized } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth.user) return unauthorized(auth.status);
  return Response.json({ date: puzzleDate(), puzzleNumber: puzzleNumber(), wordLength: 5, attempts: 6 });
}

export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth.user) return unauthorized(auth.status);
  const body = (await request.json().catch(() => null)) as { guess?: string; attempt?: number } | null;
  const guess = body?.guess?.trim().toLowerCase() ?? "";
  if (!/^[a-z]{5}$/.test(guess)) return Response.json({ error: "Enter a five-letter word." }, { status: 400 });

  let valid = COMMON_GUESSES.has(guess);
  if (!valid) {
    try {
      const response = await fetch(`https://wordsohard.com/api/v1/define/${encodeURIComponent(guess)}`, {
        signal: AbortSignal.timeout(1800),
        next: { revalidate: 86_400 },
      });
      if (response.ok) {
        const data = (await response.json()) as { found?: boolean; scrabble?: { valid?: boolean } };
        valid = Boolean(data.found && data.scrabble?.valid);
      }
    } catch {
      // The local common-word set keeps the daily game playable when the external dictionary is unavailable.
    }
  }
  if (!valid) return Response.json({ error: "Not in the word list." }, { status: 422 });

  const answer = getDailyAnswer();
  const evaluation = evaluateGuess(guess, answer);
  const won = guess === answer;
  const finished = won || (body?.attempt ?? 0) >= 6;
  return Response.json({ evaluation, won, ...(finished ? { answer } : {}) });
}
