export type TileState = "empty" | "filled" | "absent" | "present" | "correct";
export type Evaluation = Array<Exclude<TileState, "empty" | "filled">>;

export const ANSWERS = [
  "crane", "flame", "brisk", "ocean", "plant", "shine", "vivid", "grape", "charm", "sweep",
  "proud", "cabin", "dream", "toast", "light", "frost", "pearl", "smile", "quiet", "bloom",
  "spice", "train", "cloud", "heart", "maple", "dance", "river", "stone", "honey", "glass",
  "tiger", "crown", "beach", "lemon", "spark", "sugar", "world", "feast", "green", "swift",
  "chess", "coral", "magic", "north", "piano", "roast", "slice", "trail", "whale", "zesty",
  "adore", "blaze", "candy", "daisy", "eagle", "fable", "giant", "happy", "ivory", "jolly",
  "karma", "lunar", "mango", "noble", "olive", "petal", "queen", "raven", "solar", "tulip",
  "unity", "valor", "waltz", "youth", "zebra", "amber", "berry", "cedar", "drift", "ember",
  "fresh", "globe", "haste", "ideal", "jewel", "kneel", "lucky", "medal", "novel", "orbit",
  "prize", "quest", "rally", "scene", "tempo", "urban", "vapor", "wheat", "yacht", "zonal"
] as const;

export const COMMON_GUESSES = new Set<string>([
  ...ANSWERS,
  "about", "above", "abuse", "actor", "acute", "admit", "adopt", "adult", "after", "again",
  "agent", "agree", "ahead", "alarm", "album", "alert", "alien", "align", "alive", "allow",
  "alone", "along", "alter", "among", "angel", "anger", "angle", "angry", "apart", "apple",
  "apply", "arena", "argue", "arise", "array", "aside", "asset", "audio", "audit", "avoid",
  "award", "aware", "badly", "baker", "bases", "basic", "basis", "began", "begin", "begun",
  "being", "below", "bench", "birth", "black", "blame", "blind", "block", "blood", "board",
  "boost", "booth", "bound", "brain", "brand", "bread", "break", "breed", "brief", "bring",
  "broad", "broke", "brown", "build", "built", "buyer", "carry", "catch", "cause", "chain",
  "chair", "chart", "chase", "cheap", "check", "chest", "chief", "child", "china", "chose",
  "civil", "claim", "class", "clean", "clear", "click", "clock", "close", "coach", "coast",
  "could", "count", "court", "cover", "craft", "crash", "cream", "crime", "cross", "crowd",
  "cycle", "daily", "death", "depth", "doing", "doubt", "dozen", "draft", "drama", "drawn",
  "dress", "drink", "drive", "drove", "dying", "early", "earth", "eight", "elite", "empty",
  "enemy", "enjoy", "enter", "entry", "equal", "error", "event", "every", "exact", "exist",
  "extra", "faith", "false", "fault", "fiber", "field", "fifth", "fifty", "fight", "final",
  "first", "fixed", "flash", "fleet", "floor", "focus", "force", "frame", "frank", "fraud",
  "front", "fruit", "fully", "funny", "given", "grand", "grant", "great", "gross", "group",
  "grown", "guard", "guess", "guest", "guide", "heard", "heavy", "hence", "horse", "hotel",
  "house", "human", "image", "index", "inner", "issue", "joint", "judge", "known", "label",
  "large", "laser", "later", "laugh", "layer", "learn", "lease", "least", "leave", "legal",
  "level", "local", "logic", "loose", "lower", "major", "maker", "march", "match", "maybe",
  "mayor", "meant", "media", "metal", "might", "minor", "model", "money", "month", "moral",
  "motor", "mount", "mouse", "mouth", "movie", "music", "needs", "never", "night", "noise",
  "occur", "offer", "often", "order", "other", "ought", "paint", "panel", "paper", "party",
  "peace", "phase", "phone", "photo", "piece", "pilot", "pitch", "place", "plain", "plane",
  "point", "pound", "power", "press", "price", "prime", "print", "prior", "proof", "range",
  "rapid", "ratio", "reach", "ready", "refer", "right", "rival", "round", "route", "royal",
  "rural", "scale", "score", "sense", "serve", "seven", "shall", "shape", "share", "sharp",
  "sheet", "shelf", "shell", "shift", "shirt", "shock", "shoot", "short", "shown", "sight",
  "since", "sixth", "sixty", "sized", "skill", "sleep", "small", "smart", "solid", "solve",
  "sorry", "sound", "south", "space", "spare", "speak", "speed", "spend", "spent", "split",
  "spoke", "sport", "staff", "stage", "stake", "stand", "start", "state", "steam", "steel",
  "stick", "still", "stock", "store", "storm", "story", "strip", "stuck", "study", "stuff",
  "style", "table", "taken", "taste", "taxes", "teach", "teeth", "thank", "their", "theme",
  "there", "these", "thick", "thing", "think", "third", "those", "three", "throw", "tight",
  "times", "title", "today", "topic", "total", "touch", "tough", "tower", "track", "trade",
  "treat", "trend", "trial", "tried", "truck", "truly", "trust", "truth", "twice", "under",
  "union", "until", "upper", "upset", "usual", "video", "virus", "visit", "vital", "voice",
  "waste", "watch", "water", "wheel", "where", "which", "while", "white", "whole", "whose",
  "woman", "women", "worth", "would", "write", "wrong", "wrote", "young"
]);

export function puzzleDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function puzzleNumber(date = new Date()): number {
  const epoch = Date.UTC(2026, 0, 1);
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return 1000 + Math.floor((day - epoch) / 86_400_000);
}

export function getDailyAnswer(date = new Date()): string {
  const n = puzzleNumber(date);
  return ANSWERS[((n % ANSWERS.length) + ANSWERS.length) % ANSWERS.length];
}

export function evaluateGuess(guess: string, answer: string): Evaluation {
  const result: Evaluation = Array(5).fill("absent");
  const remaining: Record<string, number> = {};
  for (let i = 0; i < 5; i += 1) {
    if (guess[i] === answer[i]) result[i] = "correct";
    else remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i += 1) {
    if (result[i] === "correct") continue;
    if ((remaining[guess[i]] ?? 0) > 0) {
      result[i] = "present";
      remaining[guess[i]] -= 1;
    }
  }
  return result;
}
