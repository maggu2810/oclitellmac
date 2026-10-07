import { expect, test } from "bun:test"
import { mapThinking } from "../src/map"

test("adaptive models get the base levels plus the reported extra levels", () => {
  expect(
    mapThinking({}, { supports_adaptive_thinking: true, supports_reasoning_efforts: ["max", "xhigh"] }),
  ).toEqual({ mode: "adaptive", efforts: ["low", "medium", "high", "xhigh", "max"] })
})

test("adaptive models without extra levels only get the base levels and max when reported", () => {
  expect(mapThinking({}, { supports_adaptive_thinking: true, supports_reasoning_efforts: ["max"] })).toEqual({
    mode: "adaptive",
    efforts: ["low", "medium", "high", "max"],
  })
  expect(mapThinking({}, { supports_adaptive_thinking: true })).toEqual({
    mode: "adaptive",
    efforts: ["low", "medium", "high"],
  })
})

test("reasoning models without adaptive thinking use a budget", () => {
  expect(mapThinking({}, { supports_reasoning: true })).toEqual({ mode: "budget" })
  expect(mapThinking({ supports_reasoning: true }, {})).toEqual({ mode: "budget" })
})

test("models without reasoning have no thinking", () => {
  expect(mapThinking({}, {})).toBeUndefined()
})
