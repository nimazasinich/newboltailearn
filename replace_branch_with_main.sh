#!/bin/bash

# Git Branch Replacement Script
# This script safely replaces a target branch with the exact contents of 'main'
# 
# Usage: ./replace_branch_with_main.sh <TARGET_BRANCH>
# Example: ./replace_branch_with_main.sh backup/ci-fixes-2025-09-16
#
# ⚠️  WARNING: This will overwrite the target branch's history on remote!

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if target branch is provided
if [ $# -eq 0 ]; then
    print_error "Target branch name is required!"
    echo "Usage: $0 <TARGET_BRANCH>"
    echo "Example: $0 backup/ci-fixes-2025-09-16"
    exit 1
fi

TARGET_BRANCH="$1"

# Validate we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository!"
    exit 1
fi

print_step "Starting branch replacement process..."
echo "Target branch: $TARGET_BRANCH"
echo "Source: main"
echo

# Check if main branch exists
if ! git show-ref --verify --quiet refs/heads/main; then
    print_error "Main branch does not exist locally!"
    exit 1
fi

# Check if target branch exists locally
if ! git show-ref --verify --quiet refs/heads/"$TARGET_BRANCH"; then
    print_warning "Target branch '$TARGET_BRANCH' does not exist locally."
    echo "Attempting to fetch from remote..."
    
    # Try to fetch the branch from remote
    if git fetch origin "$TARGET_BRANCH":"$TARGET_BRANCH" 2>/dev/null; then
        print_success "Successfully fetched '$TARGET_BRANCH' from remote."
    else
        print_error "Could not fetch '$TARGET_BRANCH' from remote. Branch may not exist."
        exit 1
    fi
fi

# Show current status
print_step "Current repository status:"
git status --short
echo

# Create backup tag before proceeding
BACKUP_TAG="backup-${TARGET_BRANCH//\//-}-$(date +%Y%m%d-%H%M%S)"
print_step "Creating backup tag: $BACKUP_TAG"
if git tag "$BACKUP_TAG" "$TARGET_BRANCH"; then
    print_success "Backup tag '$BACKUP_TAG' created successfully."
else
    print_error "Failed to create backup tag!"
    exit 1
fi
echo

# Final confirmation
print_warning "⚠️  DESTRUCTIVE ACTION WARNING ⚠️"
echo "This will:"
echo "  1. Replace '$TARGET_BRANCH' with contents of 'main'"
echo "  2. Force push to remote, overwriting branch history"
echo "  3. Backup created as tag: '$BACKUP_TAG'"
echo
read -p "Are you absolutely sure you want to continue? (type 'yes' to proceed): " confirmation

if [ "$confirmation" != "yes" ]; then
    print_error "Operation cancelled by user."
    # Clean up backup tag
    git tag -d "$BACKUP_TAG" > /dev/null 2>&1 || true
    exit 1
fi

echo

# Step 1: Checkout main and pull latest changes
print_step "1. Checking out 'main' and pulling latest changes..."
git checkout main
git pull origin main
print_success "Main branch updated successfully."
echo

# Step 2: Checkout the target branch
print_step "2. Checking out target branch '$TARGET_BRANCH'..."
git checkout "$TARGET_BRANCH"
print_success "Switched to '$TARGET_BRANCH'."
echo

# Step 3: Reset the target branch to main
print_step "3. Resetting '$TARGET_BRANCH' to match 'main' exactly..."
git reset --hard main
print_success "Branch '$TARGET_BRANCH' reset to match 'main'."
echo

# Step 4: Push the branch to remote with force
print_step "4. Force pushing '$TARGET_BRANCH' to remote..."
print_warning "This will overwrite the remote branch!"
git push origin "$TARGET_BRANCH" --force
print_success "Branch '$TARGET_BRANCH' force pushed to remote."
echo

# Step 5: Verification
print_step "5. Verification - Recent commits:"
git log --oneline -n 3
echo

print_step "Repository status:"
git status
echo

print_success "✅ Branch replacement completed successfully!"
echo
echo "Summary:"
echo "  • Branch '$TARGET_BRANCH' now matches 'main' exactly"
echo "  • Remote branch has been updated (history overwritten)"
echo "  • Backup available as tag: '$BACKUP_TAG'"
echo "  • To restore backup: git checkout '$TARGET_BRANCH' && git reset --hard '$BACKUP_TAG'"
echo
print_step "Script execution completed."