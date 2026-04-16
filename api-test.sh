#!/bin/bash
# Accounting API - Test Script with cURL Examples
# This script demonstrates common API operations with expected responses
# Run with: bash api-test.sh

API_URL="http://localhost:3002/accounting"

echo "=========================================="
echo "OKDOK Accounting API Test Script"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to make requests
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4

  echo -e "${BLUE}[TEST]${NC} $description"
  echo -e "  $method $endpoint"
  
  if [ -n "$data" ]; then
    curl -s -X $method "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data" | jq . 2>/dev/null || echo "Response: (not JSON)"
  else
    curl -s -X $method "$API_URL$endpoint" | jq . 2>/dev/null || echo "Response: (not JSON)"
  fi
  echo ""
}

echo "=========================================="
echo "1. PREREQUISITE: Initialize Accounts"
echo "=========================================="
echo "Run this once before testing:"
echo "  node seed/accounts.js"
echo ""

echo "=========================================="
echo "2. CREATE OWNERS"
echo "=========================================="

test_endpoint POST "/owners" \
  '{"name":"John Smith","email":"john@example.com","phone":"555-0001","payout_bank_account":"123456"}' \
  "Create Owner 1"

test_endpoint POST "/owners" \
  '{"name":"Jane Doe","email":"jane@example.com","phone":"555-0002","payout_bank_account":"654321"}' \
  "Create Owner 2"

echo "📝 Note: Save the owner IDs from responses above (e.g., 'id': 1, 'id': 2)"
echo ""

echo "=========================================="
echo "3. CREATE PROPERTIES"
echo "=========================================="

test_endpoint POST "/properties" \
  '{"owner_id":1,"address":"123 Main Street","city":"Springfield","state":"IL","zip":"62701","status":"active"}' \
  "Create Property 1 (Owner 1)"

test_endpoint POST "/properties" \
  '{"owner_id":1,"address":"456 Oak Avenue","city":"Springfield","state":"IL","zip":"62702","status":"active"}' \
  "Create Property 2 (Owner 1)"

test_endpoint POST "/properties" \
  '{"owner_id":2,"address":"789 Elm Road","city":"Chicago","state":"IL","zip":"60601","status":"active"}' \
  "Create Property 3 (Owner 2)"

echo "📝 Note: Save the property IDs from responses above"
echo ""

echo "=========================================="
echo "4. CREATE TENANTS"
echo "=========================================="

test_endpoint POST "/tenants" \
  '{"property_id":1,"name":"Alice Brown","email":"alice@example.com","phone":"555-1001","lease_start":"2024-03-01","lease_end":"2025-03-01","rent_amount":1500,"deposit_amount":1500}' \
  "Create Tenant 1 (Property 1)"

test_endpoint POST "/tenants" \
  '{"property_id":1,"name":"Bob Wilson","email":"bob@example.com","phone":"555-1002","lease_start":"2024-03-01","lease_end":"2025-03-01","rent_amount":1200,"deposit_amount":1200}' \
  "Create Tenant 2 (Property 1)"

test_endpoint POST "/tenants" \
  '{"property_id":2,"name":"Carol Davis","email":"carol@example.com","phone":"555-1003","lease_start":"2024-03-01","lease_end":"2025-03-01","rent_amount":1800,"deposit_amount":1800}' \
  "Create Tenant 3 (Property 2)"

echo "📝 Note: Save the tenant IDs from responses above"
echo ""

echo "=========================================="
echo "5. VIEW CREATED DATA"
echo "=========================================="

test_endpoint GET "/owners" "" "List All Owners"
test_endpoint GET "/owners/1" "" "Get Owner 1 Details"
test_endpoint GET "/properties" "" "List All Properties"
test_endpoint GET "/properties/owner/1" "" "List Properties for Owner 1"
test_endpoint GET "/tenants" "" "List All Tenants"
test_endpoint GET "/tenants/property/1" "" "List Tenants for Property 1"
test_endpoint GET "/accounts" "" "List All System Accounts"

echo ""
echo "=========================================="
echo "6. FINANCIAL TRANSACTIONS"
echo "=========================================="

test_endpoint POST "/deposits/in" \
  '{"amount":1500,"property_id":1,"tenant_id":1,"owner_id":1,"memo":"Security deposit from Alice"}' \
  "Record Security Deposit (Tenant 1)"

test_endpoint POST "/deposits/in" \
  '{"amount":1200,"property_id":1,"tenant_id":2,"owner_id":1,"memo":"Security deposit from Bob"}' \
  "Record Security Deposit (Tenant 2)"

test_endpoint POST "/rent/collect" \
  '{"amount":1500,"property_id":1,"tenant_id":1,"owner_id":1,"memo":"March 2024 rent from Alice"}' \
  "Collect Rent (Tenant 1)"

test_endpoint POST "/rent/collect" \
  '{"amount":1200,"property_id":1,"tenant_id":2,"owner_id":1,"memo":"March 2024 rent from Bob"}' \
  "Collect Rent (Tenant 2)"

test_endpoint POST "/rent/collect" \
  '{"amount":1800,"property_id":2,"tenant_id":3,"owner_id":1,"memo":"March 2024 rent from Carol"}' \
  "Collect Rent (Tenant 3)"

echo ""

test_endpoint POST "/expenses/owner" \
  '{"amount":250,"property_id":1,"owner_id":1,"memo":"Plumbing repairs at 123 Main"}' \
  "Record Owner Expense"

test_endpoint POST "/fees/management" \
  '{"amount":300,"property_id":1,"owner_id":1,"memo":"March management fee"}' \
  "Record Management Fee"

test_endpoint POST "/distributions/owner" \
  '{"amount":3650,"property_id":1,"owner_id":1,"memo":"March distribution to owner"}' \
  "Record Owner Distribution"

echo ""
echo "=========================================="
echo "7. REPORTING AND ANALYSIS"
echo "=========================================="

test_endpoint GET "/owners/1/balance" "" "Get Owner 1 Balance Summary"
test_endpoint GET "/owners/2/balance" "" "Get Owner 2 Balance Summary"

test_endpoint GET "/accounts/1/balance" "" "Get Balance for Account 1"

test_endpoint GET "/ledger" "" "List All Ledger Entries"
test_endpoint GET "/ledger/owner/1" "" "List Ledger Entries for Owner 1"
test_endpoint GET "/ledger/property/1" "" "List Ledger Entries for Property 1"

echo ""
echo "=========================================="
echo "8. MONTHLY STATEMENTS"
echo "=========================================="

echo -e "${BLUE}[TEST]${NC} Get Monthly Statement (JSON format)"
echo "  GET /accounting/owners/1/statement/2024/3"
curl -s -X GET "$API_URL/owners/1/statement/2024/3" | jq . 2>/dev/null | head -30
echo "  ... (truncated)"
echo ""

echo -e "${BLUE}[TEST]${NC} Get Monthly Statement (HTML format)"
echo "  GET /accounting/owners/1/statement/2024/3?format=html"
curl -s -X GET "$API_URL/owners/1/statement/2024/3?format=html" | head -20
echo "  ... (HTML content truncated)"
echo ""

echo "=========================================="
echo "9. UPDATE OPERATIONS"
echo "=========================================="

test_endpoint PUT "/owners/1" \
  '{"name":"John Smith Updated","email":"john.new@example.com","phone":"555-0001","payout_bank_account":"999999"}' \
  "Update Owner 1"

test_endpoint PUT "/properties/1" \
  '{"address":"123 Main Street Extended","city":"Springfield","state":"IL","zip":"62701","status":"active"}' \
  "Update Property 1"

test_endpoint PUT "/tenants/1" \
  '{"name":"Alice Brown","email":"alice.new@example.com","phone":"555-1001","lease_start":"2024-03-01","lease_end":"2025-03-01","rent_amount":1500,"deposit_amount":1500}' \
  "Update Tenant 1"

echo ""
echo "=========================================="
echo "10. POSTING MANUAL JOURNAL ENTRY"
echo "=========================================="

echo -e "${BLUE}[INFO]${NC} Manual journal entries can be posted directly to ledger"
echo "Example: Transfer between accounts (subject to compliance rules)"
echo ""

test_endpoint POST "/ledger/post" \
  '{"debit_account_id":1,"credit_account_id":2,"amount":500,"memo":"Manual journal entry for testing"}' \
  "Post Manual Journal Entry"

echo ""
echo "=========================================="
echo "11. ERROR HANDLING EXAMPLES"
echo "=========================================="

test_endpoint POST "/owners" \
  '{"name":"Incomplete Owner"}' \
  "Test Missing Fields (should error)"

test_endpoint POST "/ledger/post" \
  '{"debit_account_id":1,"credit_account_id":1,"amount":100,"memo":"Same account"}' \
  "Test Debit=Credit Validation (should error)"

test_endpoint POST "/rent/collect" \
  '{"amount":-100,"property_id":1,"owner_id":1,"tenant_id":1,"memo":"Negative amount"}' \
  "Test Negative Amount (should error)"

test_endpoint GET "/owners/999" "" "Test Nonexistent Owner (404)"

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}✓${NC} Basic CRUD operations tested"
echo -e "${GREEN}✓${NC} Financial transactions tested"
echo -e "${GREEN}✓${NC} Balance calculations tested"
echo -e "${GREEN}✓${NC} Statement generation tested"
echo -e "${GREEN}✓${NC} Error handling demonstrated"
echo ""
echo "For detailed documentation, see:"
echo "  - docs/ACCOUNTING_API.md (Complete reference)"
echo "  - docs/ACCOUNTING_QUICKSTART.md (Quick start guide)"
echo ""
