#!/bin/bash

# Test 4 Core Features APIs
# Run after: npm run dev (in another terminal)

API="http://localhost:3000/api"

echo "🧪 Testing XBase Top 4 Features APIs..."
echo ""

# These tests assume you're logged in and have a project
# Adjust PROJECT_ID to match a real project from your account

PROJECT_ID="test-project"  # Replace with real project ID

# Test 1: Catalog Search
echo "1️⃣  Data Catalog Search"
echo "POST /api/catalog/search"
curl -X POST "$API/catalog/search" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"query\":\"user\",\"type\":\"all\"}" \
  -w "\nStatus: %{http_code}\n" 2>/dev/null | jq . 2>/dev/null || echo "(API call made)"

echo ""
echo "2️⃣  Query Test Generation"
echo "POST /api/tests/generate"
curl -X POST "$API/tests/generate" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"query\":\"SELECT * FROM users LIMIT 10;\"}" \
  -w "\nStatus: %{http_code}\n" 2>/dev/null | jq . 2>/dev/null || echo "(API call made)"

echo ""
echo "3️⃣  Quality Metrics (Completeness)"
echo "POST /api/quality/metrics"
curl -X POST "$API/quality/metrics" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"rows\":[{\"id\":1,\"name\":\"Alice\"},{\"id\":2,\"name\":null}],\"metricType\":\"completeness\",\"column\":\"name\"}" \
  -w "\nStatus: %{http_code}\n" 2>/dev/null | jq . 2>/dev/null || echo "(API call made)"

echo ""
echo "4️⃣  Performance Analysis (sample EXPLAIN)"
echo "POST /api/execution/performance"
SAMPLE_EXPLAIN=$(cat << 'EOF'
{
  "Plan": {
    "Node Type": "Seq Scan",
    "Relation Name": "users",
    "Actual Loops": 1,
    "Actual Total Time": 2.5,
    "Plans": []
  },
  "Planning Time": 0.1,
  "Execution Time": 2.5
}
EOF
)
curl -X POST "$API/execution/performance" \
  -H "Content-Type: application/json" \
  -d "{\"explainJson\":$SAMPLE_EXPLAIN}" \
  -w "\nStatus: %{http_code}\n" 2>/dev/null | jq . 2>/dev/null || echo "(API call made)"

echo ""
echo "✅ API test complete. Check logs above for response statuses (200/401/403 expected)"
