#!/bin/bash
# ============================================================
# AI Sprint Planner — API Test Suite
# Endpoint: POST http://localhost:3000/v1/plans
# ============================================================

URL="http://localhost:3000/v1/plans"
HEADER="Content-Type: application/json"

# Common payload fragments
DESCRIPTION='{"description":"The MGROC-style grocery e-commerce backend provides a complete platform for managing grocery products, customers, orders, payments, delivery, administration, content, and business operations. It covers foundational services such as project architecture, database, authentication, OTP, security, validation, logging, and multilingual support; catalog features including files, categories, brands, products, drafts and publishing; customer features such as accounts, addresses, wishlist, cart, checkout, pricing, coupons, payments, and GST invoices; administrative features including roles, permissions, staff, delivery agents, order management, and reports; and growth features such as banners, CMS, deep links, SEO, emails, queues, social login, leads, expenses, translations, warehouses, and invoice/order edge-case handling","project_name":"Mgroc demo 1","project_id":"6aa3dcab151ea1909a177bd9"}'

FEATURES_FULL='["Project scaffold & architecture","Database layer","Authentication core","OTP service","Auth middleware chain","Security hardening","Request validation framework","i18n","Logging & tracing","Standard API envelope","File service","Master data","Product management (admin)","Product catalog (customer)","App version gating & maintenance mode","Customer accounts","Address book","Wishlist & recent searches","Cart","Checkout & orders","Pricing engine","Payment status & paid orders","GST invoices","P3 — Admin Panel, Staff & Reporting","ACL (roles & permissions)","Admin user management","Delivery-agent module","Reports","Order management (admin)","Banner management","CMS content","Deep links","SEO management","Transactional emails","Queue & pub/sub integration","Social login","Lead management","Expense management","Multi-language data translations","Company/multi-warehouse readiness","Order regeneration & invoicing edge cases"]'

FEATURES_SMALL='["Project scaffold & architecture","Database layer","Authentication core","OTP service","Cart","Checkout & orders","Customer accounts","Admin user management"]'

BASE_DATE='"start_date":"2026-09-13"'

echo "============================================================"
echo "TEST 1: Team Size Increase (3 → 8 members)"
echo "============================================================"
echo "Hypothesis: More team members → fewer sprints / shorter timeline"
echo ""
curl -s -X POST "$URL" \
  -H "$HEADER" \
  -d "{
    $DESCRIPTION,
    $BASE_DATE,
    \"team_breakdown\":{\"ui\":2,\"backend\":3,\"app\":2,\"others\":1},
    \"features\":$FEATURES_FULL
  }" | python -m json.tool 2>/dev/null || echo "Response saved (possibly non-JSON)"

echo ""
echo "============================================================"
echo "TEST 2: Team Size Decrease (3 → 1 member)"
echo "============================================================"
echo "Hypothesis: Fewer team members → more sprints / longer timeline"
echo ""
curl -s -X POST "$URL" \
  -H "$HEADER" \
  -d "{
    $DESCRIPTION,
    $BASE_DATE,
    \"team_breakdown\":{\"backend\":1},
    \"features\":$FEATURES_FULL
  }" | python -m json.tool 2>/dev/null || echo "Response saved (possibly non-JSON)"

echo ""
echo "============================================================"
echo "TEST 3: Fewer Features (40 → 8 features)"
echo "============================================================"
echo "Hypothesis: Fewer features → fewer sprints, shorter timeline"
echo ""
curl -s -X POST "$URL" \
  -H "$HEADER" \
  -d "{
    $DESCRIPTION,
    $BASE_DATE,
    \"team_breakdown\":{\"ui\":1,\"backend\":1,\"app\":1},
    \"features\":$FEATURES_SMALL
  }" | python -m json.tool 2>/dev/null || echo "Response saved (possibly non-JSON)"

echo ""
echo "============================================================"
echo "TEST 4: Rules/Scope Provided — Deadline Impact Check"
echo "============================================================"
echo "Rules: 'Feature implementing sprint should have features name wise mile stone'"
echo "Deadline: 2026-12-31"
echo "Hypothesis: AI should distribute sprints to meet the deadline"
echo ""
curl -s -X POST "$URL" \
  -H "$HEADER" \
  -d "{
    $DESCRIPTION,
    $BASE_DATE,
    \"team_breakdown\":{\"ui\":1,\"backend\":1,\"app\":1},
    \"deadline\":\"2026-12-31\",
    \"rules\":\"Feature implementing sprint should have features name wise mile stone\",
    \"features\":$FEATURES_FULL
  }" | python -m json.tool 2>/dev/null || echo "Response saved (possibly non-JSON)"

echo ""
echo "============================================================"
echo "TEST 5: Logical Request — Verify Response Structure"
echo "============================================================"
echo "Checking: sprint count, feature names in sprints, date consistency, assumptions"
echo ""
curl -s -X POST "$URL" \
  -H "$HEADER" \
  -d "{
    $DESCRIPTION,
    $BASE_DATE,
    \"team_breakdown\":{\"ui\":1,\"backend\":1,\"app\":1},
    \"sprint_length_weeks\":2,
    \"rules\":\"Each sprint must be feature-wise and include milestone names\",
    \"features\":$FEATURES_SMALL
  }" | python -m json.tool 2>/dev/null || echo "Response saved (possibly non-JSON)"

echo ""
echo "============================================================"
echo "All 5 tests completed. Compare outputs above."
echo "============================================================"
