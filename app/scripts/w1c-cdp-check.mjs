import { writeFile } from "node:fs/promises";

const DEBUG_URL = "http://127.0.0.1:9333";
const APP_URL = "http://127.0.0.1:3939/";

const targetResponse = await fetch(
  `${DEBUG_URL}/json/new?${encodeURIComponent(APP_URL)}`,
  { method: "PUT" },
);
if (!targetResponse.ok) {
  throw new Error(`CDP target creation failed: ${targetResponse.status}`);
}
const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) {
    return;
  }
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) {
    reject(new Error(JSON.stringify(message.error)));
  } else {
    resolve(message.result);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text);
  }
  return response.result.value;
}

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitFor(expression, timeoutMs = 5_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await evaluate(expression)) {
      return;
    }
    await wait(50);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: APP_URL });
await waitFor("document.readyState === 'complete'");
await waitFor(
  "Array.from(document.querySelectorAll('button')).some((button) => button.innerText.includes('돈을 보냈어요'))",
);
await evaluate(
  "Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('돈을 보냈어요')).click()",
);
await waitFor("document.querySelectorAll('[data-testid=\"action-card\"]').length > 0");

const initial = await evaluate(`(() => {
  const firstCard = document.querySelector('[data-testid="action-card"][data-priority="1"]');
  const fineLink = Array.from(document.querySelectorAll('a')).find(
    (link) => link.textContent.includes('내 금융회사 대표번호 찾기')
  );
  const emergency = document.querySelector('.emergency-question').getBoundingClientRect();
  const actions = document.querySelector('.actions-section').getBoundingClientRect();
  const firstRect = firstCard.getBoundingClientRect();
  const visibleText = document.body.innerText;
  return {
    emptyTelLinks: document.querySelectorAll('a[href="tel:"]').length,
    tel112Links: document.querySelectorAll('a[href="tel:112"]').length,
    tel1394Links: document.querySelectorAll('a[href="tel:1394"]').length,
    fineHref: fineLink?.getAttribute('href') ?? null,
    fineTarget: fineLink?.getAttribute('target') ?? null,
    fineRel: fineLink?.getAttribute('rel') ?? null,
    officialNumberNote: document.querySelector('.official-number-note')?.textContent
      .replace(/\\s+/g, ' ').trim() ?? null,
    firstTitle: firstCard?.querySelector('h3')?.textContent.trim() ?? null,
    questionIntro: firstCard?.querySelector('.question-card-intro')?.textContent
      .replace(/\\s+/g, ' ').trim() ?? null,
    questionLegends: Array.from(firstCard?.querySelectorAll('fieldset legend') ?? [])
      .map((legend) => legend.textContent.trim()),
    questionShowsCallPurpose: firstCard?.innerText.includes('이 전화나 확인에서 할 일') ?? false,
    questionShowsScript: firstCard?.innerText.includes('말할 내용') ?? false,
    questionShowsCopy: firstCard?.innerText.includes('문구 복사') ?? false,
    visibleInternalCopy:
      visibleText.includes('미확인 상태') || visibleText.includes('상태 확인 질문'),
    normalGapPx: Math.round((actions.top - emergency.bottom) * 100) / 100,
    firstCardTopPx: Math.round(firstRect.top * 100) / 100,
    firstCardVisiblePx: Math.round(
      Math.max(0, Math.min(window.innerHeight, firstRect.bottom) - Math.max(0, firstRect.top)) * 100
    ) / 100,
    viewportHeightPx: window.innerHeight,
  };
})()`);

await evaluate(`(() => {
  const fineLink = Array.from(document.querySelectorAll('a')).find(
    (link) => link.textContent.includes('내 금융회사 대표번호 찾기')
  );
  fineLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
  fineLink.click();
})()`);
await wait(100);
const dialerRecordedAfterFine = await evaluate(
  "document.body.innerText.includes('전화 앱 열기를 선택함')",
);

await evaluate(
  "document.querySelector('#question-card-device_compromise_state-none').click()",
);
await waitFor(
  "document.querySelector('[data-testid=\"action-card\"][data-priority=\"1\"] h3')?.textContent.trim() !== '먼저 확인할 것'",
);
const answerResult = await evaluate(`(() => ({
  firstTitleAfterAnswer: document.querySelector(
    '[data-testid="action-card"][data-priority="1"] h3'
  )?.textContent.trim() ?? null,
  stateEditorDeviceNone: document.querySelector(
    '#device_compromise_state-none'
  )?.checked ?? false,
}))()`);

await evaluate("document.querySelector('.easy-toggle input').click()");
await waitFor("document.querySelector('main').classList.contains('easy-mode')");
const easyGapPx = await evaluate(`(() => {
  const emergency = document.querySelector('.emergency-question').getBoundingClientRect();
  const actions = document.querySelector('.actions-section').getBoundingClientRect();
  return Math.round((actions.top - emergency.bottom) * 100) / 100;
})()`);

const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
await writeFile(
  "/private/tmp/w1c-production-1280.png",
  Buffer.from(screenshot.data, "base64"),
);

await send("Page.navigate", { url: APP_URL });
await waitFor("document.readyState === 'complete'");
await waitFor(
  "Array.from(document.querySelectorAll('button')).some((button) => button.innerText.includes('해당 없음·모름'))",
);
await evaluate(
  "Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('해당 없음·모름')).click()",
);
await waitFor("document.querySelector('#device_compromise_state-none') !== null");

for (const id of [
  "device_compromise_state-none",
  "credential_exposure_state-shared",
  "personal_data_exposure_state-none",
  "safe_device_available-yes",
]) {
  await evaluate(`document.querySelector('#${id}').click()`);
  await wait(75);
}

const folded = await evaluate(`(() => ({
  tel1332Links: document.querySelectorAll('a[href="tel:1332"]').length,
  hasFoldedActions: document.querySelector('details.next-steps') !== null,
  emptyTelLinks: document.querySelectorAll('a[href="tel:"]').length,
}))()`);

const failures = [];
if (initial.emptyTelLinks !== 0) failures.push("empty tel link remains");
if (initial.tel112Links < 1) failures.push("tel:112 is missing");
if (initial.tel1394Links < 1) failures.push("tel:1394 is missing");
if (initial.fineHref !== "https://fine.fss.or.kr") failures.push("FINE href");
if (initial.fineTarget !== "_blank") failures.push("FINE target");
if (initial.fineRel !== "noopener noreferrer") failures.push("FINE rel");
if (
  initial.officialNumberNote !==
  "상대가 알려준 번호가 아니라 카드 뒷면·공식 앱·공식 홈페이지의 대표번호를 사용하세요."
) {
  failures.push("official-number fixed copy");
}
if (dialerRecordedAfterFine) failures.push("FINE click recorded dialer_opened");
if (initial.firstTitle !== "먼저 확인할 것") failures.push("question title");
if (initial.questionIntro !== "먼저 3가지만 확인할게요.") {
  failures.push("question intro");
}
if (initial.questionLegends.length !== 3) failures.push("question axis count");
if (initial.questionShowsCallPurpose) failures.push("question call-purpose copy");
if (initial.questionShowsScript) failures.push("question phone script");
if (initial.questionShowsCopy) failures.push("question copy control");
if (initial.visibleInternalCopy) failures.push("visible internal question copy");
if (!answerResult.stateEditorDeviceNone) failures.push("state editor sync");
if (answerResult.firstTitleAfterAnswer === "먼저 확인할 것") {
  failures.push("card did not recompose");
}
if (!(initial.normalGapPx <= 40)) failures.push("normal action gap too large");
if (!(easyGapPx >= 52 && easyGapPx > initial.normalGapPx)) {
  failures.push("easy-mode spacing not preserved");
}
if (!folded.hasFoldedActions) failures.push("next_steps missing");
if (folded.tel1332Links < 1) failures.push("folded tel:1332 missing");
if (folded.emptyTelLinks !== 0) failures.push("empty tel after state changes");

const result = {
  browser: "Chromium headless shell via CDP",
  viewport: { width: 1280, height: 900 },
  initial,
  dialerRecordedAfterFine,
  answerResult,
  easyGapPx,
  folded,
  screenshot: "/private/tmp/w1c-production-1280.png",
  failures,
};
console.log(JSON.stringify(result, null, 2));

await fetch(`${DEBUG_URL}/json/close/${target.id}`);
socket.close();
if (failures.length > 0) {
  process.exitCode = 1;
}
