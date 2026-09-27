#!/bin/sh
# Git pre-push hook: ensure no uncommitted source changes exist before pushing.
# Install with: cp scripts/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
node scripts/check-clean-source.js --mode=source
if [ $? -ne 0 ]; then
  echo "❌ Git push aborted: uncommitted changes detected in source code."
  echo "Please commit your changes before pushing."
  exit 1
fi
