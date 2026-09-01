#!/bin/bash
set -e
export OLLAMA_HOST=127.0.0.1:11434
echo "Starting ollama..."
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!
sleep 2

echo "Starting API server..."
./scripts/startup-enhanced.sh start --detach
sleep 5

echo "Running m13 test..."
node --import tsx scripts/m13-live-cert.ts
