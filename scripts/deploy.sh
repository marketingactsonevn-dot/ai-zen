#!/bin/sh
# Publish dist/ (Vietnamese at /, English at /en/) to the gh-pages branch → GitHub Pages.
set -e
cd "$(dirname "$0")/.."
REMOTE=$(git remote get-url origin)
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(date +%Y-%m-%d)"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Deployed to gh-pages."
