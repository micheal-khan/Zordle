import OpenAI from "openai";
import { getDailyAnswer } from "@/lib/game";
import { getRequestUser, unauthorized } from "@/lib/supabase-server";

function fallbackHint(answer: string) {
  const vowels = answer.split("").filter((letter) => "aeiou".includes(letter)).length;
  return `It has ${vowels || "no"} vowel${vowels === 1 ? "" : "s"} and begins in the ${answer[0] < "n" ? "first" : "second"} half of the alphabet.`;
}

export async function POST(request: Request) {
  const auth = await getRequestUser(request);
  if (!auth.user) return unauthorized(auth.status);
  const body = (await request.json().catch(() => null)) as { guesses?: string[] } | null;
  const guesses = Array.isArray(body?.guesses) ? body.guesses.slice(0, 6) : [];
  const answer = getDailyAnswer();
  if (!process.env.OPENAI_API_KEY) return Response.json({ hint: fallbackHint(answer), source: "smart-fallback" });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_HINT_MODEL || "gpt-5.6-luna",
      input: `Secret five-letter word: ${answer}. Previous guesses: ${guesses.join(", ") || "none"}. Give one playful, subtle clue under 16 words. Never reveal, spell, rhyme with, or show any letter positions from the answer.`,
      max_output_tokens: 60,
    });
    return Response.json({ hint: response.output_text.trim() || fallbackHint(answer), source: "openai" });
  } catch {
    return Response.json({ hint: fallbackHint(answer), source: "smart-fallback" });
  }
}
