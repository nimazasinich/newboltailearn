#!/bin/bash

# =============================================================================
# Safe Git Branch Creation Script: runflare from main
# =============================================================================
# This script creates a new branch 'runflare' from 'main' without altering main
# Compatible with Linux, macOS, and Windows Git Bash
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting safe branch creation process..."
echo "Target: Create 'runflare' branch from 'main'"
echo "============================================="

# =============================================================================
# STEP 1: BACKUP AND SAFETY CHECKS
# =============================================================================
echo ""
echo "📋 STEP 1: Backup and Safety Checks"
echo "-----------------------------------"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ ERROR: Not in a Git repository!"
    exit 1
fi

# Show current status
echo "📍 Current repository status:"
git status --porcelain
echo ""

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  WARNING: You have uncommitted changes!"
    echo "Please commit or stash your changes before proceeding."
    echo "Current changes:"
    git status --short
    exit 1
fi

# Store current branch for potential rollback
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "💾 Current branch: $ORIGINAL_BRANCH"

# =============================================================================
# STEP 2: CHECKOUT MAIN AND UPDATE
# =============================================================================
echo ""
echo "📥 STEP 2: Checkout main and update"
echo "-----------------------------------"

# Switch to main branch
echo "🔄 Switching to main branch..."
git checkout main

# Fetch latest changes from remote
echo "📡 Fetching latest changes from remote..."
git fetch origin

# Update main branch
echo "⬇️  Pulling latest changes into main..."
git pull origin main

# Show current main commit
MAIN_COMMIT=$(git rev-parse HEAD)
echo "✅ Main branch updated. Current commit: $MAIN_COMMIT"

# =============================================================================
# STEP 3: CREATE NEW BRANCH
# =============================================================================
echo ""
echo "🌿 STEP 3: Create new branch"
echo "----------------------------"

# Check if branch already exists locally
if git show-ref --verify --quiet refs/heads/runflare; then
    echo "⚠️  Branch 'runflare' already exists locally!"
    echo "Current branches:"
    git branch -a
    echo ""
    echo "Do you want to delete the existing branch and recreate it? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing local branch 'runflare'..."
        git branch -D runflare
    else
        echo "❌ Aborting to avoid conflicts."
        exit 1
    fi
fi

# Create new branch from main
echo "🆕 Creating new branch 'runflare' from main..."
git checkout -b runflare

# Verify we're on the new branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "✅ Successfully created and switched to branch: $CURRENT_BRANCH"

# =============================================================================
# STEP 4: PUSH NEW BRANCH TO REMOTE
# =============================================================================
echo ""
echo "📤 STEP 4: Push new branch to remote"
echo "------------------------------------"

# Check if branch exists on remote
if git ls-remote --heads origin runflare | grep -q runflare; then
    echo "⚠️  Branch 'runflare' already exists on remote!"
    echo "This will overwrite the remote branch. Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ Aborting push to remote."
        echo "Local branch 'runflare' has been created but not pushed."
        exit 1
    fi
fi

# Push new branch to remote and set upstream
echo "🚀 Pushing new branch to remote and setting upstream..."
git push -u origin runflare

echo "✅ Branch 'runflare' successfully pushed to remote with upstream tracking"

# =============================================================================
# STEP 5: VERIFY BRANCH
# =============================================================================
echo ""
echo "🔍 STEP 5: Verify branch"
echo "------------------------"

# Show all branches
echo "📋 All branches (local and remote):"
git branch -a

echo ""
echo "🔍 Branch verification:"

# Get commit hashes
MAIN_COMMIT_FINAL=$(git rev-parse main)
RUNFLARE_COMMIT=$(git rev-parse runflare)

echo "📍 Main branch commit:     $MAIN_COMMIT_FINAL"
echo "📍 Runflare branch commit: $RUNFLARE_COMMIT"

# Verify they match
if [ "$MAIN_COMMIT_FINAL" = "$RUNFLARE_COMMIT" ]; then
    echo "✅ SUCCESS: Both branches point to the same commit!"
else
    echo "❌ ERROR: Branches have different commits!"
    echo "This should not happen. Please investigate."
    exit 1
fi

# Show branch tracking information
echo ""
echo "📡 Branch tracking information:"
git branch -vv

# =============================================================================
# COMPLETION SUMMARY
# =============================================================================
echo ""
echo "🎉 BRANCH CREATION COMPLETED SUCCESSFULLY!"
echo "=========================================="
echo "✅ New branch 'runflare' created from 'main'"
echo "✅ Branch pushed to remote with upstream tracking"
echo "✅ Main branch remains unchanged"
echo "✅ Both branches point to commit: $MAIN_COMMIT_FINAL"
echo ""
echo "🔄 Current branch: $(git rev-parse --abbrev-ref HEAD)"
echo "📁 Repository status:"
git status --short

echo ""
echo "🚀 You can now start working on the 'runflare' branch!"
echo "💡 To switch back to main: git checkout main"
echo "💡 To switch to runflare: git checkout runflare"