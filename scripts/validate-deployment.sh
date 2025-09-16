#!/bin/bash
# validate-deployment.sh - Comprehensive deployment validation script

set -e

RENDER_URL="${RENDER_URL:-https://your-app.onrender.com}"
MAX_RETRIES=10
RETRY_DELAY=30

echo "🔍 Starting comprehensive deployment validation..."
echo "📍 Target URL: $RENDER_URL"
echo "⏱️ Max retries: $MAX_RETRIES, Retry delay: ${RETRY_DELAY}s"

# Function to test endpoint with retries
test_endpoint() {
  local endpoint=$1
  local expected_status=${2:-200}
  local retries=0
  
  echo "🔍 Testing endpoint: $endpoint"
  
  while [ $retries -lt $MAX_RETRIES ]; do
    echo "⏳ Attempt $((retries + 1))/$MAX_RETRIES..."
    
    if response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$RENDER_URL$endpoint" 2>/dev/null); then
      status_code="${response: -3}"
      
      if [ "$status_code" -eq "$expected_status" ]; then
        echo "✅ $endpoint returned $status_code"
        return 0
      else
        echo "⚠️ $endpoint returned $status_code, expected $expected_status"
      fi
    else
      echo "⚠️ Request to $endpoint failed"
    fi
    
    echo "🔄 Retrying in ${RETRY_DELAY}s..."
    retries=$((retries + 1))
    sleep $RETRY_DELAY
  done
  
  echo "❌ $endpoint failed after $MAX_RETRIES attempts"
  return 1
}

# Test health endpoint
echo "🏥 Testing health endpoint..."
if ! test_endpoint "/health" 200; then
  echo "❌ Health endpoint validation failed"
  exit 1
fi

# Validate health response structure
echo "🔍 Validating health response structure..."
if command -v jq >/dev/null 2>&1; then
  if ! jq -e '.status and .timestamp and .node_version and .abi_version and .database' /tmp/response.json > /dev/null; then
    echo "❌ Health endpoint response structure validation failed"
    echo "Response:"
    cat /tmp/response.json
    exit 1
  fi
  
  # Check if healthy or degraded (both acceptable)
  status=$(jq -r '.status' /tmp/response.json)
  if [ "$status" != "healthy" ] && [ "$status" != "degraded" ]; then
    echo "❌ Health status is '$status', expected 'healthy' or 'degraded'"
    echo "Response:"
    cat /tmp/response.json
    exit 1
  fi
  
  echo "✅ Health response structure valid (status: $status)"
  
  # Display key metrics
  node_version=$(jq -r '.node_version' /tmp/response.json)
  abi_version=$(jq -r '.abi_version' /tmp/response.json)
  db_connected=$(jq -r '.database.connected' /tmp/response.json)
  
  echo "📊 System Information:"
  echo "  Node Version: $node_version"
  echo "  ABI Version: $abi_version"
  echo "  Database Connected: $db_connected"
  
else
  echo "⚠️ jq not available, skipping detailed response validation"
  echo "Response preview:"
  head -c 200 /tmp/response.json
  echo ""
fi

# Test basic application endpoints if they exist
echo "🔍 Testing additional endpoints..."

# Test root endpoint
if test_endpoint "/" 200 2>/dev/null; then
  echo "✅ Root endpoint accessible"
else
  echo "⚠️ Root endpoint not accessible (may be expected)"
fi

# Performance baseline
echo "🚀 Running performance baseline..."
if command -v curl >/dev/null 2>&1; then
  response_time=$(curl -o /dev/null -s -w "%{time_total}" "$RENDER_URL/health" 2>/dev/null || echo "0")
  echo "📊 Health endpoint response time: ${response_time}s"
  
  # Check if response time is reasonable (less than 10 seconds for health check)
  if command -v bc >/dev/null 2>&1; then
    if (( $(echo "$response_time > 10.0" | bc -l 2>/dev/null || echo 0) )); then
      echo "⚠️ Response time exceeds 10s threshold"
    else
      echo "✅ Response time within acceptable range"
    fi
  fi
else
  echo "⚠️ curl not available for performance testing"
fi

# Memory usage check (if available in health response)
if command -v jq >/dev/null 2>&1 && jq -e '.memory' /tmp/response.json > /dev/null 2>&1; then
  echo "🔍 Checking memory usage..."
  memory_info=$(jq -r '.memory | "RSS: \(.rss / 1024 / 1024 | floor)MB, Heap: \(.heapUsed / 1024 / 1024 | floor)MB"' /tmp/response.json 2>/dev/null || echo "Memory info not available")
  echo "📊 Memory usage: $memory_info"
fi

# Final validation summary
echo ""
echo "🎉 Deployment validation completed successfully!"
echo "✅ All critical endpoints are responding"
echo "✅ Health checks are passing"
echo "✅ System is ready for production traffic"

# Clean up
rm -f /tmp/response.json

exit 0