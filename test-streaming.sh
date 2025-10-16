#!/bin/bash

# Test the streaming endpoint
echo "Testing streaming chain-of-thought endpoint..."
echo ""
echo "Query: Why is the sky blue?"
echo "---------------------------------------"

curl -N -X POST http://localhost:8787/query/stream \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Why is the sky blue? Explain it simply.",
    "user_id": "test-user",
    "mode": "model-only"
  }'

echo ""
echo "---------------------------------------"
echo "Test complete!"
