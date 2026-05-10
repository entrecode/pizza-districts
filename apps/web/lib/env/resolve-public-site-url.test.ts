import { describe, expect, it } from "vitest";
import { resolvePublicSiteUrl } from "./resolve-public-site-url";

describe("resolvePublicSiteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL when set", () => {
    expect(
      resolvePublicSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://pizza.example",
        VERCEL_URL: "foo.vercel.app",
      }),
    ).toBe("https://pizza.example");
  });

  it("falls back to https://VERCEL_URL", () => {
    expect(
      resolvePublicSiteUrl({
        VERCEL_URL: "my-app-git-main-org.vercel.app",
      }),
    ).toBe("https://my-app-git-main-org.vercel.app");
  });

  it("returns undefined when neither is set", () => {
    expect(resolvePublicSiteUrl({})).toBeUndefined();
  });
});
