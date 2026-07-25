#!/usr/bin/env node
// ~/.claude/settings.json 에 SessionStart 훅 항목을 안전하게(기존 설정 보존, 중복 방지) 병합한다.
// 사용법: node merge-settings.js <settings.json 경로> <훅 스크립트 절대경로>

const fs = require("fs");

const [, , settingsPath, hookScriptPath] = process.argv;

if (!settingsPath || !hookScriptPath) {
  console.error("사용법: node merge-settings.js <settings.json> <hook-script-path>");
  process.exit(1);
}

let settings = {};
if (fs.existsSync(settingsPath)) {
  const raw = fs.readFileSync(settingsPath, "utf8").trim();
  settings = raw ? JSON.parse(raw) : {};
}

settings.hooks = settings.hooks || {};
settings.hooks.SessionStart = settings.hooks.SessionStart || [];

const alreadyInstalled = settings.hooks.SessionStart.some((entry) =>
  (entry.hooks || []).some((h) => h.command === hookScriptPath)
);

if (!alreadyInstalled) {
  settings.hooks.SessionStart.push({
    hooks: [{ type: "command", command: hookScriptPath, timeout: 5 }],
  });
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
console.log(
  `SessionStart 훅 ${alreadyInstalled ? "이미 등록되어 있음" : "등록 완료"}: ${hookScriptPath}`
);
