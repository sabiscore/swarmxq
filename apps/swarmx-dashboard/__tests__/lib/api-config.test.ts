import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_API_URL,
  resolveClientApiBaseUrl,
  resolveServerApiUrl,
} from "../../src/lib/api-config";

describe("api-config", () => {
  const originalPublicUrl = process.env["NEXT_PUBLIC_SWARMX_API_URL"];
  const originalServerUrl = process.env["SWARMX_API_URL"];

  afterEach(() => {
    if (originalPublicUrl !== undefined) {
      process.env["NEXT_PUBLIC_SWARMX_API_URL"] = originalPublicUrl;
    } else {
      delete process.env["NEXT_PUBLIC_SWARMX_API_URL"];
    }

    if (originalServerUrl !== undefined) {
      process.env["SWARMX_API_URL"] = originalServerUrl;
    } else {
      delete process.env["SWARMX_API_URL"];
    }
  });

  describe("resolveClientApiBaseUrl", () => {
    it("returns empty string by default to use relative Next.js API route proxy", () => {
      delete process.env["NEXT_PUBLIC_SWARMX_API_URL"];
      expect(resolveClientApiBaseUrl()).toBe("");
    });

    it("returns sanitized URL when NEXT_PUBLIC_SWARMX_API_URL is configured", () => {
      process.env["NEXT_PUBLIC_SWARMX_API_URL"] = "https://api.example.com/ ";
      expect(resolveClientApiBaseUrl()).toBe("https://api.example.com");

      process.env["NEXT_PUBLIC_SWARMX_API_URL"] = "http://localhost:3001///";
      expect(resolveClientApiBaseUrl()).toBe("http://localhost:3001");
    });
  });

  describe("resolveServerApiUrl", () => {
    it("returns default 127.0.0.1:3001 when SWARMX_API_URL is not set", () => {
      delete process.env["SWARMX_API_URL"];
      expect(resolveServerApiUrl()).toBe(DEFAULT_API_URL);
    });

    it("returns sanitized SWARMX_API_URL when configured", () => {
      process.env["SWARMX_API_URL"] = "https://api.custom.com/swarmx///";
      expect(resolveServerApiUrl()).toBe("https://api.custom.com/swarmx");
    });
  });
});
