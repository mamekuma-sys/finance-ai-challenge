from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3217"
VIEWPORTS = [360, 768, 1280, 1440]
COLOR_SCHEMES = ["light", "dark"]


def run() -> None:
    failures: list[str] = []
    runs: list[dict[str, object]] = []
    axe_path = Path("node_modules/axe-core/axe.min.js").resolve()
    browser_candidates = sorted(
        (
            Path.home()
            / "Library"
            / "Caches"
            / "ms-playwright"
        ).glob(
            "chromium_headless_shell-*/"
            "chrome-headless-shell-mac-arm64/chrome-headless-shell"
        )
    )
    executable_path = str(browser_candidates[-1]) if browser_candidates else None

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=executable_path,
        )
        for width in VIEWPORTS:
            for color_scheme in COLOR_SCHEMES:
                context = browser.new_context(
                    viewport={"width": width, "height": 900},
                    color_scheme=color_scheme,
                    reduced_motion="reduce",
                )
                page = context.new_page()
                console_messages: list[str] = []
                page_errors: list[str] = []
                requests: list[tuple[str, str]] = []
                page.on(
                    "console",
                    lambda message: (
                        console_messages.append(
                            f"{message.type}: {message.text}"
                        )
                        if message.type in {"error", "warning"}
                        else None
                    ),
                )
                page.on("pageerror", lambda error: page_errors.append(str(error)))
                page.on(
                    "request",
                    lambda request: requests.append(
                        (request.resource_type, request.url)
                    ),
                )

                response = page.goto(BASE_URL, wait_until="networkidle")
                if response is None or response.status != 200:
                    failures.append(
                        f"{width}/{color_scheme}: / status is not 200"
                    )
                initial_request_count = len(requests)
                page.get_by_role("button", name="돈을 보냈어요").click()
                page.get_by_test_id("action-card").first.wait_for(state="visible")
                page.wait_for_timeout(100)

                overflow = page.evaluate(
                    "() => document.documentElement.scrollWidth - "
                    "document.documentElement.clientWidth"
                )
                if overflow > 0:
                    failures.append(
                        f"{width}/{color_scheme}: horizontal overflow {overflow}px"
                    )

                interaction_requests = requests[initial_request_count:]
                dynamic_requests = [
                    item
                    for item in interaction_requests
                    if item[0] in {"fetch", "xhr", "eventsource", "websocket"}
                ]
                if dynamic_requests:
                    failures.append(
                        f"{width}/{color_scheme}: interaction network {dynamic_requests}"
                    )

                primary_height = page.locator(
                    ".action-card-first .primary-action, "
                    ".action-card-first .primary-check"
                ).first.evaluate("(element) => element.getBoundingClientRect().height")
                if primary_height < 48:
                    failures.append(
                        f"{width}/{color_scheme}: primary action {primary_height}px"
                    )

                page.get_by_label("큰 글씨·쉬운 화면").check()
                easy_font_size = page.locator("main").evaluate(
                    "(element) => getComputedStyle(element).fontSize"
                )
                easy_primary_height = page.locator(
                    ".action-card-first .primary-action, "
                    ".action-card-first .primary-check"
                ).first.evaluate("(element) => element.getBoundingClientRect().height")
                easy_card_count = page.get_by_test_id("action-card").count()
                if easy_font_size != "20px":
                    failures.append(
                        f"{width}/{color_scheme}: easy font {easy_font_size}"
                    )
                if easy_primary_height < 56:
                    failures.append(
                        f"{width}/{color_scheme}: easy action {easy_primary_height}px"
                    )
                if easy_card_count != 1:
                    failures.append(
                        f"{width}/{color_scheme}: easy cards {easy_card_count}"
                    )

                page.add_script_tag(path=str(axe_path))
                axe_result = page.evaluate(
                    """async () => {
                      const result = await axe.run(document, {
                        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa',
                          'wcag21a', 'wcag21aa', 'wcag22aa'] }
                      });
                      return result.violations.map(v => ({
                        id: v.id,
                        impact: v.impact,
                        nodes: v.nodes.length
                      }));
                    }"""
                )
                if axe_result:
                    failures.append(
                        f"{width}/{color_scheme}: axe {json.dumps(axe_result, ensure_ascii=False)}"
                    )

                screenshot_path = (
                    f"/private/tmp/w1b-{width}-{color_scheme}.png"
                )
                page.screenshot(path=screenshot_path, full_page=width <= 768)

                runs.append(
                    {
                        "viewport": width,
                        "scheme": color_scheme,
                        "horizontal_overflow_px": overflow,
                        "interaction_dynamic_requests": len(dynamic_requests),
                        "primary_action_height_px": round(primary_height, 2),
                        "easy_font_size": easy_font_size,
                        "easy_primary_height_px": round(easy_primary_height, 2),
                        "easy_visible_cards": easy_card_count,
                        "axe_violations": axe_result,
                        "console_messages": console_messages,
                        "page_errors": page_errors,
                        "screenshot": screenshot_path,
                    }
                )
                if console_messages:
                    failures.append(
                        f"{width}/{color_scheme}: console {console_messages}"
                    )
                if page_errors:
                    failures.append(
                        f"{width}/{color_scheme}: page errors {page_errors}"
                    )
                context.close()

        llms_page = browser.new_page()
        llms_response = llms_page.goto(f"{BASE_URL}/llms.txt")
        llms_text = llms_page.locator("body").inner_text()
        if llms_response is None or llms_response.status != 200:
            failures.append("/llms.txt status is not 200")
        for section_number in range(1, 9):
            if f"{section_number}." not in llms_text:
                failures.append(f"/llms.txt missing section {section_number}")
        browser.close()

    result = {
        "base_url": BASE_URL,
        "runs": runs,
        "llms_status": 200,
        "failures": failures,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
