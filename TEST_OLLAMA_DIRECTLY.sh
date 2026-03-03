#!/bin/bash

echo "Testing Ollama directly to check for contamination..."
echo ""
echo "Test 1: Simple greeting"
curl -X POST http://localhost:11434/api/generate \
-H "Content-Type: application/json" \
-d '{
"model": "phi3:mini",
"prompt": "You are Griff, a friendly griffin mascot. User: hi griff",
"stream": false
}' | jq -r '.response'

echo ""
echo "============================================"
echo ""
echo "Test 2: Focus request (should return JSON)"
curl -X POST http://localhost:11434/api/generate \
-H "Content-Type: application/json" \
-d '{
"model": "phi3:mini",
"prompt": "You are Griff, a friendly griffin mascot helping users stay focused.\n\nWhen a user tells you about their task or goal, respond ONLY with valid JSON in this exact format:\n{\n  \"intent\": \"what the user wants to focus on\",\n  \"suggestions\": [\"youtube.com\", \"reddit.com\", \"instagram.com\"],\n  \"message\": \"A short encouraging message from Griff\"\n}\n\nRules:\n- Always include 3-5 popular distracting websites to block\n- Keep the message short and encouraging\n- Output ONLY the JSON, no other text before or after\n- Do not mention Pomodoro\n\nUser: I need to study for my exam",
"stream": false
}' | jq -r '.response'

echo ""
echo "============================================"
echo ""
echo "Test 3: Check if phi3 has context memory"
curl -X POST http://localhost:11434/api/generate \
-H "Content-Type: application/json" \
-d '{
"model": "phi3:mini",
"prompt": "Hello",
"stream": false
}' | jq -r '.response'
