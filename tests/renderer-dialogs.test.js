const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("renderer does not use unsupported browser modal APIs", () => {
  const renderer = fs.readFileSync(
    path.join(__dirname, "..", "src", "js", "renderer.js"),
    "utf8",
  );

  assert.equal(renderer.includes("window.prompt("), false);
  assert.equal(renderer.includes("window.alert("), false);
  assert.equal(renderer.includes("window.confirm("), false);
});
