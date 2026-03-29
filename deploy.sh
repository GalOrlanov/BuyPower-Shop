#!/bin/bash
# BuyPower Deploy Script
# Usage: ./deploy.sh "optional commit message"

KEY="/Users/gal/.openclaw/workspace/.ssh/buypower-key"
SERVER="root@64.23.156.254"
REMOTE_DIR="/root/.openclaw/workspace/BuyPower-Shop"
MSG="${1:-deploy: $(date '+%Y-%m-%d %H:%M')}"

echo "🚀 Pushing to git..."
git add -A
git commit -m "$MSG" 2>/dev/null || echo "⚡ Nothing new to commit"
git push

echo "📦 Deploying to buypower.co.il..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" "
  cd $REMOTE_DIR &&
  git pull origin main &&
  # Copy JS route files to dist
  cp api/src/api/routes/*.js api/dist/api/routes/ 2>/dev/null || true &&
  # Copy shop HTML files to nginx-served directory
  cp shop/*.html /var/www/shop/ &&
  # Restart buypower-shop service (port 3001)
  systemctl restart buypower-shop &&
  echo '✅ Deploy done!'
"
