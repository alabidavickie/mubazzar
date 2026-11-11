import { expect, test } from "@playwright/test";
import { signedInPage } from "./admin-helpers";

// The footer's "Follow us" links: the owner's Facebook page and WhatsApp channel show right away, and the
// admin can change them (or add Instagram/TikTok) under Homepage without a code change.
test("footer shows the social pages and the admin can change them", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "admin-only spec runs once");

  await page.goto("/");
  const follow = page.getByRole("navigation", { name: "Follow MUBAZZAR" });
  await expect(follow.getByRole("link", { name: "Facebook" })).toHaveAttribute("href", /facebook\.com\/share\/1FJPrwXmzL/);
  await expect(follow.getByRole("link", { name: "WhatsApp channel" })).toHaveAttribute("href", /whatsapp\.com\/channel\//);
  await expect(follow.getByRole("link", { name: "Instagram" })).toHaveCount(0);
  for (const a of await follow.getByRole("link").all()) await expect(a).toHaveAttribute("rel", /noopener/);

  const admin = await signedInPage(browser, testInfo, "admin");
  await admin.goto("/admin/homepage");
  const form = admin.getByTestId("setting-social_links");

  // A link from another website is refused with a clear reason.
  await form.getByLabel("Facebook page link").fill("https://example.com/mubazzar");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByRole("alert").first()).toContainText("doesn't look like a Facebook link");

  // A valid change is saved (the setting had no database row yet) and appears in the footer.
  await form.getByLabel("Facebook page link").fill("https://www.facebook.com/share/1FJPrwXmzL/");
  await form.getByLabel("Instagram link").fill("https://www.instagram.com/mubazzar/");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByRole("status")).toHaveText("Saved.");

  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Follow MUBAZZAR" }).getByRole("link", { name: "Instagram" })).toHaveAttribute(
    "href",
    "https://www.instagram.com/mubazzar/",
  );
});
