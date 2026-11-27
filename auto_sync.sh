#!/data/data/com.termux/files/usr/bin/bash
cd ~/sammu_games
while true; do
  git fetch origin main > /dev/null 2>&1
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main)
  if [ "$LOCAL" != "$REMOTE" ]; then
    echo "🔄 New GitHub commit detected! Updating..."
    git pull origin main
    npm install --production
    pm2 restart sammugames
  fi
  sleep 30
done
