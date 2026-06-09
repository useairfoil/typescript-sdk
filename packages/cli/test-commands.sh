#!/bin/bash
# Test script for Airfoil CLI cluster commands
# Run from packages/cli: bash test-commands.sh
# Make sure Wings dev server is running first: pnpm exec tsx src/index.ts dev --docker

set -e

echo "Building CLI..."
pnpm build

CLI="node dist/index.js"
ID=$(openssl rand -hex 4)

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Testing Airfoil CLI Cluster Commands ===${NC}"
echo ""

# ============================================
# NAMESPACE COMMANDS
# ============================================
echo -e "${BLUE}=== 1. NAMESPACE COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating namespace with S3-compatible (MinIO) object store and Iceberg lake...${NC}"
$CLI cluster create-namespace s3 \
  --namespace-id test-namespace-$ID \
  --bucket-name my-test-bucket \
  --access-key-id minio-access-key \
  --secret-access-key minio-secret-key \
  --endpoint http://localhost:9000 \
  --allow-http \
  --lake iceberg
echo ""

# Alternatively, credentials can come from env vars:
# S3_ACCESS_KEY_ID=minio-access-key S3_SECRET_ACCESS_KEY=minio-secret-key \
#   $CLI cluster create-namespace s3 --namespace-id test-namespace-$ID --bucket-name ...

echo -e "${GREEN}Creating namespace with AWS object store and Parquet lake...${NC}"
$CLI cluster create-namespace aws \
  --namespace-id test-namespace-aws-$ID \
  --bucket-name my-aws-bucket \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --secret-access-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  --region us-west-2 \
  --lake parquet
echo ""

echo -e "${GREEN}Listing all namespaces...${NC}"
$CLI cluster list-namespaces
echo ""

echo -e "${GREEN}Getting namespace 'test-namespace-$ID'...${NC}"
$CLI cluster get-namespace --name namespaces/test-namespace-$ID
echo ""

# ============================================
# TABLE COMMANDS
# ============================================
echo -e "${BLUE}=== 2. TABLE COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating table with simple fields...${NC}"
$CLI cluster create-table \
  --parent namespaces/test-namespace-$ID \
  --table-id test-table-$ID \
  --fields "id:Utf8" \
  --fields "count:Int32" \
  --fields "active:Bool" \
  --fields "score:Float64" \
  --fields "timestamp:TimestampMillisecond" \
  --key-field id \
  --version-field timestamp \
  --partition-field id \
  --freshness-seconds 300
echo ""

echo -e "${GREEN}Creating table with nullable fields...${NC}"
$CLI cluster create-table \
  --parent namespaces/test-namespace-$ID \
  --table-id test-table-nullable-$ID \
  --fields "user_id:Utf8" \
  --fields "email:Utf8?" \
  --fields "age:Int32?" \
  --fields "updated_at:TimestampMillisecond" \
  --key-field user_id \
  --version-field updated_at
echo ""

echo -e "${GREEN}Listing all tables...${NC}"
$CLI cluster list-tables --parent namespaces/test-namespace-$ID
echo ""

echo -e "${GREEN}Getting table 'test-table-$ID'...${NC}"
$CLI cluster get-table --name namespaces/test-namespace-$ID/tables/test-table-$ID
echo ""

# ============================================
# CLEANUP
# ============================================
echo -e "${BLUE}=== 3. CLEANUP ===${NC}"
echo ""

echo -e "${GREEN}Deleting tables...${NC}"
$CLI cluster delete-table \
  --name namespaces/test-namespace-$ID/tables/test-table-$ID \
  --force
$CLI cluster delete-table \
  --name namespaces/test-namespace-$ID/tables/test-table-nullable-$ID \
  --force
echo ""

echo -e "${GREEN}Deleting namespaces...${NC}"
$CLI cluster delete-namespace --name namespaces/test-namespace-$ID --force
$CLI cluster delete-namespace --name namespaces/test-namespace-aws-$ID --force
echo ""

echo -e "${BLUE}=== ALL TESTS COMPLETED SUCCESSFULLY ===${NC}"
