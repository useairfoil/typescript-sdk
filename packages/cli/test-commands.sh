#!/bin/bash
# Test script for Airfoil CLI cluster commands
# Run from packages/cli: bash test-commands.sh
# Make sure Wings dev server is running first: pnpm exec tsx src/index.ts dev --docker

set -e

CLI="pnpm exec tsx src/index.ts"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Testing Airfoil CLI Cluster Commands ===${NC}"
echo ""

# ============================================
# TENANT COMMANDS
# ============================================
echo -e "${BLUE}=== 1. TENANT COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating tenant 'test-tenant'...${NC}"
$CLI cluster create-tenant --tenant-id test-tenant
echo ""

echo -e "${GREEN}Listing all tenants...${NC}"
$CLI cluster list-tenants
echo ""

echo -e "${GREEN}Getting tenant 'test-tenant'...${NC}"
$CLI cluster get-tenant --name tenants/test-tenant
echo ""

# ============================================
# OBJECT STORE COMMANDS
# ============================================
echo -e "${BLUE}=== 2. OBJECT STORE COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating AWS object store...${NC}"
$CLI cluster create-object-store aws \
  --parent tenants/test-tenant \
  --object-store-id test-aws-store \
  --bucket-name my-test-bucket \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --secret-access-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  --region us-west-2
echo ""

echo -e "${GREEN}Creating Azure object store...${NC}"
$CLI cluster create-object-store azure \
  --parent tenants/test-tenant \
  --object-store-id test-azure-store \
  --container-name mycontainer \
  --storage-account-name myazureaccount \
  --storage-account-key "myaccountkey123=="
echo ""

echo -e "${GREEN}Creating Google object store...${NC}"
$CLI cluster create-object-store google \
  --parent tenants/test-tenant \
  --object-store-id test-google-store \
  --bucket-name my-gcs-bucket \
  --service-account my-service-account@project.iam.gserviceaccount.com \
  --service-account-key "base64-encoded-key"
echo ""

echo -e "${GREEN}Creating S3-compatible object store...${NC}"
$CLI cluster create-object-store s3 \
  --parent tenants/test-tenant \
  --object-store-id test-s3-store \
  --bucket-name my-s3-bucket \
  --access-key-id minio-access-key \
  --secret-access-key minio-secret-key \
  --endpoint https://s3.example.com
echo ""

echo -e "${GREEN}Listing all object stores...${NC}"
$CLI cluster list-object-stores --parent tenants/test-tenant
echo ""

echo -e "${GREEN}Getting AWS object store...${NC}"
$CLI cluster get-object-store --name tenants/test-tenant/object-stores/test-aws-store
echo ""

# ============================================
# DATA LAKE COMMANDS
# ============================================
echo -e "${BLUE}=== 3. DATA LAKE COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating Iceberg data lake...${NC}"
$CLI cluster create-data-lake iceberg \
  --parent tenants/test-tenant \
  --data-lake-id test-iceberg-lake
echo ""

echo -e "${GREEN}Creating Parquet data lake...${NC}"
$CLI cluster create-data-lake parquet \
  --parent tenants/test-tenant \
  --data-lake-id test-parquet-lake
echo ""

echo -e "${GREEN}Listing all data lakes...${NC}"
$CLI cluster list-data-lakes --parent tenants/test-tenant
echo ""

echo -e "${GREEN}Getting Iceberg data lake...${NC}"
$CLI cluster get-data-lake --name tenants/test-tenant/data-lakes/test-iceberg-lake
echo ""

# ============================================
# NAMESPACE COMMANDS
# ============================================
echo -e "${BLUE}=== 4. NAMESPACE COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating namespace 'test-namespace'...${NC}"
$CLI cluster create-namespace \
  --parent tenants/test-tenant \
  --namespace-id test-namespace \
  --object-store tenants/test-tenant/object-stores/test-aws-store \
  --data-lake tenants/test-tenant/data-lakes/test-iceberg-lake
echo ""

echo -e "${GREEN}Listing all namespaces...${NC}"
$CLI cluster list-namespaces --parent tenants/test-tenant
echo ""

echo -e "${GREEN}Getting namespace 'test-namespace'...${NC}"
$CLI cluster get-namespace --name tenants/test-tenant/namespaces/test-namespace
echo ""

# ============================================
# TOPIC COMMANDS
# ============================================
echo -e "${BLUE}=== 5. TOPIC COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating topic with simple fields...${NC}"
$CLI cluster create-topic \
  --parent tenants/test-tenant/namespaces/test-namespace \
  --topic-id test-topic \
  --fields "id:Utf8" \
  --fields "count:Int32" \
  --fields "active:Bool" \
  --fields "score:Float64" \
  --fields "timestamp:TimestampMillisecond" \
  --partition-key id \
  --freshness-seconds 300
echo ""

echo -e "${GREEN}Creating topic with nullable fields...${NC}"
$CLI cluster create-topic \
  --parent tenants/test-tenant/namespaces/test-namespace \
  --topic-id test-topic-nullable \
  --fields "user_id:Utf8" \
  --fields "email:Utf8?" \
  --fields "age:Int32?" \
  --partition-key user_id
echo ""

echo -e "${GREEN}Listing all topics...${NC}"
$CLI cluster list-topics --parent tenants/test-tenant/namespaces/test-namespace
echo ""

echo -e "${GREEN}Getting topic 'test-topic'...${NC}"
$CLI cluster get-topic --name tenants/test-tenant/namespaces/test-namespace/topics/test-topic
echo ""

# ============================================
# CLEANUP
# ============================================
echo -e "${BLUE}=== 6. CLEANUP ===${NC}"
echo ""

echo -e "${GREEN}Deleting topics...${NC}"
$CLI cluster delete-topic \
  --name tenants/test-tenant/namespaces/test-namespace/topics/test-topic \
  --force
$CLI cluster delete-topic \
  --name tenants/test-tenant/namespaces/test-namespace/topics/test-topic-nullable \
  --force
echo ""

echo -e "${GREEN}Deleting namespace...${NC}"
$CLI cluster delete-namespace \
  --name tenants/test-tenant/namespaces/test-namespace \
  --force
echo ""

echo -e "${GREEN}Deleting data lakes...${NC}"
$CLI cluster delete-data-lake \
  --name tenants/test-tenant/data-lakes/test-iceberg-lake \
  --force
$CLI cluster delete-data-lake \
  --name tenants/test-tenant/data-lakes/test-parquet-lake \
  --force
echo ""

echo -e "${GREEN}Deleting object stores...${NC}"
$CLI cluster delete-object-store \
  --name tenants/test-tenant/object-stores/test-aws-store \
  --force
$CLI cluster delete-object-store \
  --name tenants/test-tenant/object-stores/test-azure-store \
  --force
$CLI cluster delete-object-store \
  --name tenants/test-tenant/object-stores/test-google-store \
  --force
$CLI cluster delete-object-store \
  --name tenants/test-tenant/object-stores/test-s3-store \
  --force
echo ""

echo -e "${GREEN}Deleting tenant...${NC}"
$CLI cluster delete-tenant --name tenants/test-tenant --force
echo ""

echo -e "${BLUE}=== ALL TESTS COMPLETED SUCCESSFULLY ===${NC}"
