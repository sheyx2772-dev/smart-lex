import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BankMockDataSource, DidoxDataSource, DidoxMockDataSource, createDataSource } from "./datasource/index";
import { EskizNotifier, MockNotifier, createNotifier } from "./notifications/index";

const SMS_KEYS = ["ESKIZ_TOKEN", "ESKIZ_EMAIL", "ESKIZ_PASSWORD"];
const DIDOX_KEYS = ["DIDOX_PARTNER_TOKEN"];

describe("createNotifier — SMS adapter tanlash", () => {
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved = {};
    for (const k of SMS_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of SMS_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("kalitsiz => MockNotifier", () => {
    expect(createNotifier("sms")).toBeInstanceOf(MockNotifier);
  });
  it("email+parol bilan => EskizNotifier (real)", () => {
    process.env.ESKIZ_EMAIL = "a@b.uz";
    process.env.ESKIZ_PASSWORD = "x";
    expect(createNotifier("sms")).toBeInstanceOf(EskizNotifier);
  });
  it("token bilan => EskizNotifier", () => {
    process.env.ESKIZ_TOKEN = "tkn";
    expect(createNotifier("sms")).toBeInstanceOf(EskizNotifier);
  });
  it("email kanali doim mock", () => {
    process.env.ESKIZ_TOKEN = "tkn";
    expect(createNotifier("email")).toBeInstanceOf(MockNotifier);
  });
});

describe("createDataSource — Didox adapter tanlash", () => {
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved = {};
    for (const k of DIDOX_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of DIDOX_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("company + tokensiz => DidoxMockDataSource", () => {
    expect(createDataSource("company")).toBeInstanceOf(DidoxMockDataSource);
  });
  it("company + token => DidoxDataSource (real)", () => {
    process.env.DIDOX_PARTNER_TOKEN = "partner-tkn";
    expect(createDataSource("company")).toBeInstanceOf(DidoxDataSource);
  });
  it("bank => BankMockDataSource", () => {
    expect(createDataSource("bank")).toBeInstanceOf(BankMockDataSource);
  });
});
