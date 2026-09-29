const { execSync } = require("child_process");

// Parse CLI flags
const args = process.argv.slice(2);
const skipTests = args.includes("--skip-tests");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  run("node scripts/check-clean-source.js --mode=all");
  run("npm run lint");
  if (skipTests) {
    console.log("\n⚠️  Skipping e2e tests (--skip-tests)");
  } else {
    run("npm run test:e2e");
  }
  run("npm version patch --no-git-tag-version");
  run("node scripts/sync-version.js");
  run("npm run build");
} catch (error) {
  process.exit(error.status ?? 1);
}
