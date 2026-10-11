import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "fs/promises"
import path from "path"
import { RotatingLog } from "../src/log"

let dir: string
let file: string

beforeEach(async () => {
  await mkdir("/tmp/opencode", { recursive: true })
  dir = await mkdtemp(path.join("/tmp/opencode", "oclitellmac-log-"))
  file = path.join(dir, "server.log")
})

afterEach(() => rm(dir, { recursive: true, force: true }))

test("appends lines without rotating below the limit", async () => {
  const log = new RotatingLog(file, 1000)
  await log.append("one")
  await log.append("two")
  expect(await readFile(file, "utf-8")).toBe("one\ntwo\n")
  expect(await readdir(dir)).toEqual(["server.log"])
})

test("rotates to .1 once the limit is exceeded", async () => {
  const log = new RotatingLog(file, 20)
  await log.append("a".repeat(15))
  await log.append("b".repeat(15))
  expect(await readdir(dir)).toEqual(["server.log"])
  await log.append("c")
  expect((await readdir(dir)).sort()).toEqual(["server.log", "server.log.1"])
  expect(await readFile(`${file}.1`, "utf-8")).toBe(`${"a".repeat(15)}\n${"b".repeat(15)}\n`)
  expect(await readFile(file, "utf-8")).toBe("c\n")
})

test("an existing .1 is replaced", async () => {
  await writeFile(`${file}.1`, "old generation\n")
  const log = new RotatingLog(file, 10)
  await log.append("x".repeat(20))
  await log.append("y")
  await log.append("z".repeat(20))
  await log.append("w")
  expect(await readFile(`${file}.1`, "utf-8")).toBe(`y\n${"z".repeat(20)}\n`)
  expect(await readFile(file, "utf-8")).toBe("w\n")
})

test("the size counter starts from the existing file", async () => {
  await writeFile(file, "x".repeat(50))
  const log = new RotatingLog(file, 40)
  await log.append("fresh")
  expect(await readFile(`${file}.1`, "utf-8")).toBe("x".repeat(50))
  expect((await stat(file)).size).toBe(6)
})

test("IO errors are swallowed", async () => {
  const log = new RotatingLog(path.join(dir, "missing", "server.log"), 100)
  await log.append("lost")
  await log.append("still fine")
})
