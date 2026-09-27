const { execSync } = require("child_process");

// Parse CLI flags: --mode=all | --mode=source (default)
const args = process.argv.slice(2);
const modeArg = args.find((a) => a.startsWith("--mode="));
const mode = modeArg ? modeArg.split("=")[1] : "source";

function getGitStatus() {
  try {
    const output = execSync("git status --porcelain", {
      encoding: "utf-8",
    });
    if (!output.trim()) return [];
    return output.split("\n").filter((line) => line.length > 0);
  } catch (error) {
    console.error("Failed to run git status:", error.message);
    process.exit(1);
  }
}

function parseStatusLine(line) {
  const match = line.match(/^.. (.+)$/);
  if (!match) return line.trim();
  const filePath = match[1].trim();
  if (filePath.includes(" -> ")) {
    return filePath.split(" -> ")[1].trim();
  }
  return filePath;
}

const statusLines = getGitStatus();
if (statusLines.length === 0) {
  process.exit(0);
}

// In 'all' mode (e.g. before npm run release begins), nothing should be uncommitted
if (mode === "all") {
  console.error("\n❌ Release check failed:");
  console.error(
    "Uncommitted changes or untracked files detected in repository:"
  );
  statusLines.forEach((line) => console.error(`  ${line}`));
  console.error(
    "\nPlease commit or stash all changes before creating a release.\n"
  );
  process.exit(1);
}

// In 'source' mode (e.g. prebuild / pre-push), ignore files that are naturally
// modified as part of the release workflow
const releaseAllowedPrefixes = [
  "docs/",
  "ios/",
  "android/",
  "package.json",
  "package-lock.json",
  "RELEASE_NOTES.md",
];

const dirtySourceFiles = statusLines.filter((line) => {
  const file = parseStatusLine(line);
  const isAllowed = releaseAllowedPrefixes.some(
    (prefix) => file === prefix || file.startsWith(prefix)
  );
  return !isAllowed;
});

if (dirtySourceFiles.length > 0) {
  console.error("\n❌ Source check failed:");
  console.error("Uncommitted changes detected in source code:");
  dirtySourceFiles.forEach((line) => console.error(`  ${line}`));
  console.error(
    "\nAll source code changes must be committed in clean, isolated commits before building for production.\n"
  );
  process.exit(1);
}

process.exit(0);
