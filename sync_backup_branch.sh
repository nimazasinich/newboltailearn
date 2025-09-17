#!/bin/bash

# Git Branch Sync Script
# Makes remote branch "backup/ci-fixes-2025-09-16" identical to "main"
# with safety backups and proper error handling

set -euo pipefail  # Fail fast on errors, undefined vars, pipe failures

# Configuration
TARGET_BRANCH="backup/ci-fixes-2025-09-16"
REMOTE="origin"
BACKUP_BRANCH="${TARGET_BRANCH}-backup-$(date +%Y%m%d%H%M%S)"

echo "=== Git Branch Sync Script ==="
echo "Target branch: $TARGET_BRANCH"
echo "Remote: $REMOTE"
echo "Backup branch: $BACKUP_BRANCH"
echo

# Function to print and execute commands
run_cmd() {
    echo "$ $*"
    "$@"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "ERROR: Not in a git repository"
    exit 1
fi

# Step 1: Ensure working tree is clean
echo "=== Step 1: Checking working tree status ==="
if ! git diff-index --quiet HEAD --; then
    echo "ERROR: Working tree has uncommitted changes:"
    git status --porcelain
    echo
    echo "Please commit or stash your changes before running this script."
    exit 1
fi
echo "✓ Working tree is clean"
echo

# Step 2: Fetch latest from remote
echo "=== Step 2: Fetching latest from remote ==="
run_cmd git fetch --prune "$REMOTE"
echo "✓ Fetch completed"
echo

# Step 3: Create backup of existing remote branch (if it exists)
echo "=== Step 3: Creating backup of existing remote branch ==="
if git ls-remote --heads "$REMOTE" | grep -q "refs/heads/$TARGET_BRANCH"; then
    echo "Remote branch $REMOTE/$TARGET_BRANCH exists, creating backup..."
    
    # Create local backup branch pointing to remote
    run_cmd git branch "$BACKUP_BRANCH" "$REMOTE/$TARGET_BRANCH"
    
    # Push backup branch to remote
    run_cmd git push "$REMOTE" "$BACKUP_BRANCH"
    
    # Get and display backup info
    BACKUP_SHA=$(git rev-parse "$REMOTE/$TARGET_BRANCH")
    echo "✓ Backup created:"
    echo "  Branch: $BACKUP_BRANCH"
    echo "  SHA: $BACKUP_SHA"
    echo "  Remote: $REMOTE/$BACKUP_BRANCH"
else
    echo "Remote branch $REMOTE/$TARGET_BRANCH does not exist (will be created)"
fi
echo

# Step 4: Checkout and update main
echo "=== Step 4: Updating main branch ==="
run_cmd git checkout main
run_cmd git pull "$REMOTE" main
echo "✓ Main branch updated"
echo

# Step 5: Create/reset target branch to match main
echo "=== Step 5: Creating/resetting target branch ==="
run_cmd git checkout -B "$TARGET_BRANCH" main
echo "✓ Target branch $TARGET_BRANCH now matches main"
echo

# Step 6: Optional build/test steps (commented out)
echo "=== Step 6: Optional build/test steps (commented) ==="
echo "# Uncomment the following lines if you want to run build/test before pushing:"
echo "# npm ci"
echo "# npm run build"
echo "# npm test"
echo

# Step 7: Force push with lease
echo "=== Step 7: Force pushing to remote ==="
run_cmd git push -u "$REMOTE" "$TARGET_BRANCH" --force-with-lease
echo "✓ Force push completed successfully"
echo

# Step 8: Verification
echo "=== Step 8: Verification ==="
echo "Remote branch status:"
run_cmd git ls-remote --heads "$REMOTE" "$TARGET_BRANCH"
echo
echo "Recent commits on $TARGET_BRANCH:"
run_cmd git log "$TARGET_BRANCH" -n 5 --pretty=oneline
echo

# Step 9: Summary
echo "=== SUMMARY ==="
MAIN_SHA=$(git rev-parse main)
TARGET_SHA=$(git rev-parse "$TARGET_BRANCH")

echo "✓ Operation completed successfully!"
echo
echo "Branch Status:"
echo "  main:              $MAIN_SHA"
echo "  $TARGET_BRANCH: $TARGET_SHA"
echo
if git ls-remote --heads "$REMOTE" | grep -q "refs/heads/$BACKUP_BRANCH"; then
    echo "Backup Information:"
    echo "  Backup branch:     $BACKUP_BRANCH"
    echo "  Backup available at: $REMOTE/$BACKUP_BRANCH"
    echo
fi
echo "Verification Commands:"
echo "  git log main..$TARGET_BRANCH  # Should show no commits"
echo "  git log $TARGET_BRANCH..main  # Should show no commits"
echo "  git diff main $TARGET_BRANCH  # Should show no differences"
echo
echo "The remote branch '$REMOTE/$TARGET_BRANCH' is now identical to 'main'."

exit 0