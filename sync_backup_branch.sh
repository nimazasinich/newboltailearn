#!/bin/bash

# Script to safely make remote branch "backup/ci-fixes-2025-09-16" identical to "main"
# This script creates backups, checks for uncommitted changes, and uses safe force push

set -euo pipefail  # Fail fast on errors, undefined vars, and pipe failures

# Variables
TARGET_BRANCH="backup/ci-fixes-2025-09-16"
REMOTE="origin"
BACKUP_BRANCH="${TARGET_BRANCH}-backup-$(date +%Y%m%d%H%M%S)"

echo "=== Git Branch Sync Script ==="
echo "Target branch: $TARGET_BRANCH"
echo "Remote: $REMOTE"
echo "Backup branch: $BACKUP_BRANCH"
echo

# Function to print and execute git commands
run_git() {
    echo "$ git $*"
    git "$@"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "ERROR: Not in a git repository!"
    exit 1
fi

# Step 1: Ensure working tree is clean
echo "=== Step 1: Checking working tree status ==="
if ! git diff-index --quiet HEAD --; then
    echo "ERROR: Working tree has uncommitted changes!"
    echo "Please commit or stash your changes before running this script."
    echo
    echo "Current status:"
    git status --porcelain
    exit 1
fi

if ! git diff-index --quiet --cached HEAD --; then
    echo "ERROR: Index has staged changes!"
    echo "Please commit your staged changes before running this script."
    echo
    echo "Current status:"
    git status --porcelain
    exit 1
fi

echo "✓ Working tree is clean"
echo

# Step 2: Fetch latest from remote
echo "=== Step 2: Fetching latest from remote ==="
run_git fetch --prune "$REMOTE"
echo

# Step 3: Create backup if remote target branch exists
echo "=== Step 3: Creating backup of existing remote branch ==="
if git ls-remote --heads "$REMOTE" "$TARGET_BRANCH" | grep -q "$TARGET_BRANCH"; then
    echo "Remote branch $REMOTE/$TARGET_BRANCH exists, creating backup..."
    
    # Create local backup branch pointing to remote
    run_git branch "$BACKUP_BRANCH" "$REMOTE/$TARGET_BRANCH"
    
    # Push backup branch to remote
    run_git push "$REMOTE" "$BACKUP_BRANCH"
    
    # Print backup information
    BACKUP_SHA=$(git rev-parse "$REMOTE/$TARGET_BRANCH")
    echo "✓ Backup created:"
    echo "  Branch: $BACKUP_BRANCH"
    echo "  Remote SHA: $BACKUP_SHA"
    echo "  Command to restore: git push $REMOTE $BACKUP_BRANCH:$TARGET_BRANCH --force-with-lease"
else
    echo "Remote branch $REMOTE/$TARGET_BRANCH does not exist, no backup needed"
fi
echo

# Step 4: Checkout and update main
echo "=== Step 4: Updating main branch ==="
run_git checkout main
run_git pull "$REMOTE" main
echo "✓ Main branch updated"
echo

# Step 5: Create/reset target branch to match main
echo "=== Step 5: Creating/resetting target branch ==="
run_git checkout -B "$TARGET_BRANCH" main
echo "✓ Local $TARGET_BRANCH now matches main"
echo

# Step 6: Optional build/test steps (commented out)
echo "=== Step 6: Optional build/test steps (currently disabled) ==="
echo "# Uncomment the following lines if you want to run build/test before push:"
echo "# npm ci"
echo "# npm run build"
echo "# npm test"
echo

# Step 7: Force push with lease
echo "=== Step 7: Force pushing to remote ==="
run_git push -u "$REMOTE" "$TARGET_BRANCH" --force-with-lease
echo "✓ Successfully pushed $TARGET_BRANCH to $REMOTE"
echo

# Step 8: Verification
echo "=== Step 8: Verification ==="
echo "Remote branch status:"
run_git ls-remote --heads "$REMOTE" "$TARGET_BRANCH"
echo
echo "Recent commits on $TARGET_BRANCH:"
run_git log "$TARGET_BRANCH" -n 5 --pretty=oneline
echo

# Step 9: Summary
echo "=== SUMMARY ==="
MAIN_SHA=$(git rev-parse main)
TARGET_SHA=$(git rev-parse "$TARGET_BRANCH")
REMOTE_TARGET_SHA=$(git rev-parse "$REMOTE/$TARGET_BRANCH")

echo "✅ Operation completed successfully!"
echo
echo "Branch states:"
echo "  main:                    $MAIN_SHA"
echo "  $TARGET_BRANCH:      $TARGET_SHA"
echo "  $REMOTE/$TARGET_BRANCH: $REMOTE_TARGET_SHA"
echo

if [ "$MAIN_SHA" = "$TARGET_SHA" ] && [ "$TARGET_SHA" = "$REMOTE_TARGET_SHA" ]; then
    echo "✅ Verification: All branches are in sync!"
else
    echo "⚠️  WARNING: Branch SHAs don't match as expected!"
    exit 1
fi

if git ls-remote --heads "$REMOTE" "$BACKUP_BRANCH" | grep -q "$BACKUP_BRANCH"; then
    echo "📦 Backup branch '$BACKUP_BRANCH' is available on remote"
    echo "   To restore: git push $REMOTE $BACKUP_BRANCH:$TARGET_BRANCH --force-with-lease"
fi

echo
echo "🎉 Remote branch '$REMOTE/$TARGET_BRANCH' is now identical to 'main'"
echo "   Current branch: $(git branch --show-current)"

exit 0