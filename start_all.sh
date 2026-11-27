#!/data/data/com.termux/files/usr/bin/bash
MAIN_DIR="$HOME/sammu_games"
PAGES_DIR="$HOME/play"
LOG_FILE="$MAIN_DIR/.cf.log"
termux-wake-lock
pkill -f "node.*server.js" 2>/dev/null
pkill -f "cloudflared" 2>/dev/null
sleep 1
(
  while true; do
    cd "$MAIN_DIR"
    node --env-file=.env server.js >> "$MAIN_DIR/server.log" 2>&1
    sleep 3
  done
) &
echo "✅ Node server running on port 3000"
while true; do
  rm -f "$LOG_FILE"
  echo "🔄 Starting stable HTTP2 Cloudflare Tunnel..."
  cloudflared tunnel --protocol http2 --url http://localhost:3000 > "$LOG_FILE" 2>&1 &
  CF_PID=$!
  URL=""
  for i in $(seq 1 30); do
    URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG_FILE" | head -n 1)
    if [ -n "$URL" ]; then break; fi
    sleep 1
  done
  if [ -n "$URL" ]; then
    echo "🚀 TUNNEL READY: $URL (waiting 10s for Cloudflare DNS...)"
    sleep 10
    cd "$PAGES_DIR"
    git fetch origin 2>/dev/null
    git reset --hard origin/main 2>/dev/null || git reset --hard origin/master 2>/dev/null
    echo "$URL" > url.txt
    printf '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sammu Games</title></head><body style="background:#090d16;color:#fff;text-align:center;padding-top:20vh;font-family:sans-serif"><h2>🌐 Connecting to Sammu Games...</h2><script>fetch("url.txt?t="+Date.now(),{cache:"no-store"}).then(r=>r.text()).then(u=>location.replace(u.trim()))</script></body></html>\n' > index.html
    git add index.html url.txt
    git commit -m "Tunnel: $URL"
    git push -f origin HEAD
    echo "✅ LIVE & PUSHED: $URL"
    cd "$MAIN_DIR"
  else
    echo "⚠️ Cloudflare rate-limited or slow, cooling down 30s..."
    kill $CF_PID 2>/dev/null
    sleep 30
    continue
  fi
  wait $CF_PID
  echo "🔄 Tunnel closed, restarting in 10s..."
  sleep 10
done
