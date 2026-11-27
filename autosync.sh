#!/data/data/com.termux/files/usr/bin/bash
echo "🔄 GitHub Auto-Sync Watcher Active..."

while inotifywait -r -e modify,create,delete --exclude '(\.git|node_modules|\.json$|\.log$|\.bak$|\.backup\.js$)' .; do
  sleep 4
  if [[ -n $(git status --porcelain) ]]; then
    git add .
    git commit -m "Termux auto-update: $(date '+%Y-%m-%d %H:%M:%S')"
    git push origin main && echo "✅ Synced to GitHub at $(date '+%H:%M:%S')"
  fi
done
