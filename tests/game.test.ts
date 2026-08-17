import assert from "node:assert/strict";
import test from "node:test";
import { evaluateGuess, getDailyAnswer, puzzleNumber } from "../lib/game";

test("scores exact, present, and absent letters", () => {
  assert.deepEqual(evaluateGuess("crane", "cabin"), ["correct", "absent", "present", "present", "absent"]);
});

test("does not over-credit duplicate letters", () => {
  assert.deepEqual(evaluateGuess("eerie", "sweep"), ["present", "present", "absent", "absent", "absent"]);
});

test("daily puzzle selection is deterministic", () => {
  const date = new Date("2026-08-17T12:00:00Z");
  assert.equal(getDailyAnswer(date), getDailyAnswer(date));
  assert.equal(puzzleNumber(date), 1228);
});
