#!/bin/bash
# Test script for Airfoil CLI cluster commands
# Make sure Wings dev server is running first: bun run airfoil:dev --docker

set -e  # Exit on error

echo "=== Testing Airfoil CLI Cluster Commands ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# TENANT COMMANDS
# ============================================
echo -e "${BLUE}=== 1. TENANT COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating tenant 'test-tenant'...${NC}"
bun run airfoil:dev cluster create-tenant --tenant-id test-tenant
echo ""

echo -e "${GREEN}Listing all tenants...${NC}"
bun run airfoil:dev cluster list-tenants
echo ""

echo -e "${GREEN}Getting tenant 'test-tenant'...${NC}"
bun run airfoil:dev cluster get-tenant --name tenants/test-tenant
echo ""

# ============================================
# OBJECT STORE COMMANDS
# ============================================
echo -e "${BLUE}=== 2. OBJECT STORE COMMANDS ===${NC}"
echo ""

# AWS Object Store
echo -e "${GREEN}Creating AWS object store...${NC}"
bun run airfoil:dev cluster create-object-store aws \
  --parent tenants/test-tenant \
  --object-store-id test-aws-store \
  --bucket-name my-test-bucket \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --secret-access-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  --region us-west-2
echo ""

# Azure Object Store
echo -e "${GREEN}Creating Azure object store...${NC}"
bun run airfoil:dev cluster create-object-store azure \
  --parent tenants/test-tenant \
  --object-store-id test-azure-store \
  --container-name mycontainer \
  --storage-account-name myazureaccount \
  --storage-account-key "myaccountkey123=="
echo ""

# Google Object Store
echo -e "${GREEN}Creating Google object store...${NC}"
bun run airfoil:dev cluster create-object-store google \
  --parent tenants/test-tenant \
  --object-store-id test-google-store \
  --bucket-name my-gcs-bucket \
  --service-account my-service-account@project.iam.gserviceaccount.com \
  --service-account-key "base64-encoded-key"
echo ""

# S3-compatible Object Store
echo -e "${GREEN}Creating S3-compatible object store...${NC}"
bun run airfoil:dev cluster create-object-store s3 \
  --parent tenants/test-tenant \
  --object-store-id test-s3-store \
  --bucket-name my-s3-bucket \
  --access-key-id minio-access-key \
  --secret-access-key minio-secret-key \
  --endpoint https://s3.example.com
echo ""

echo -e "${GREEN}Listing all object stores...${NC}"
bun run airfoil:dev cluster list-object-stores --parent tenants/test-tenant
echo ""

echo -e "${GREEN}Getting AWS object store...${NC}"
bun run airfoil:dev cluster get-object-store --name tenants/test-tenant/object-stores/test-aws-store
echo ""

# ============================================
# DATA LAKE COMMANDS
# ============================================
echo -e "${BLUE}=== 3. DATA LAKE COMMANDS ===${NC}"
echo ""

# Iceberg Data Lake
echo -e "${GREEN}Creating Iceberg data lake...${NC}"
bun run airfoil:dev cluster create-data-lake iceberg \
  --parent tenants/test-tenant \
  --data-lake-id test-iceberg-lake
echo ""

# Parquet Data Lake
echo -e "${GREEN}Creating Parquet data lake...${NC}"
bun run airfoil:dev cluster create-data-lake parquet \
  --parent tenants/test-tenant \
  --data-lake-id test-parquet-lake
echo ""

echo -e "${GREEN}Listing all data lakes...${NC}"
bun run airfoil:dev cluster list-data-lakes --parent tenants/test-tenant
echo ""

echo -e "${GREEN}Getting Iceberg data lake...${NC}"
bun run airfoil:dev cluster get-data-lake --name tenants/test-tenant/data-lakes/test-iceberg-lake
echo ""

# ============================================
# NAMESPACE COMMANDS
# ============================================
echo -e "${BLUE}=== 4. NAMESPACE COMMANDS ===${NC}"
echo ""

echo -e "${GREEN}Creating namespace 'test-namespace' in tenant 'test-tenant' with object store and data lake...${NC}"
bun run airfoil:dev cluster create-namespace \
  --parent tenants/test-tenant \
  --namespace-id test-namespace \
  --object-store tenants/test-tenant/object-stores/test-aws-store \
  --data-lake tenants/test-tenant/data-lakes/test-iceberg-lake
echo ""

echo -e "${GREEN}Listing all namespaces in tenant 'test-tenant'...${NC}"
bun run airfoil:dev cluster list-namespaces --parent tenants/test-tenant
echo ""

echo -e "${GREEN}Getting namespace 'test-namespace'...${NC}"
bun run airfoil:dev cluster get-namespace --name tenants/test-tenant/namespaces/test-namespace
echo ""

# ============================================
# TOPIC COMMANDS
# ============================================
echo -e "${BLUE}=== 5. TOPIC COMMANDS ===${NC}"
echo ""

# Create topic with simple fields
echo -e "${GREEN}Creating topic 'test-topic' with simple fields...${NC}"
bun run airfoil:dev cluster create-topic \
  --parent tenants/test-tenant/namespaces/test-namespace \
  --topic-id test-topic \
  --fields "id:Utf8" "count:Int32" "active:Bool" "score:Float64" "timestamp:TimestampMillisecond" \
  --partition-key id \
  --freshness-seconds 300
echo ""

# Create topic with nullable fields
echo -e "${GREEN}Creating topic 'test-topic-nullable' with nullable fields...${NC}"
bun run airfoil:dev cluster create-topic \
  --parent tenants/test-tenant/namespaces/test-namespace \
  --topic-id test-topic-nullable \
  --fields "user_id:Utf8" "email:Utf8?" "age:Int32?" \
  --partition-key user_id
echo ""

echo -e "${GREEN}Listing all topics in namespace...${NC}"
bun run airfoil:dev cluster list-topics --parent tenants/test-tenant/namespaces/test-namespace
echo ""

echo -e "${GREEN}Getting topic 'test-topic'...${NC}"
bun run airfoil:dev cluster get-topic --name tenants/test-tenant/namespaces/test-namespace/topics/test-topic
echo ""

# ============================================
# CLEANUP (DELETE) COMMANDS
# ============================================
echo -e "${BLUE}=== 6. CLEANUP (Testing Delete Commands) ===${NC}"
echo ""

echo -e "${GREEN}Deleting topics...${NC}"
bun run airfoil:dev cluster delete-topic --name tenants/test-tenant/namespaces/test-namespace/topics/test-topic --force
bun run airfoil:dev cluster delete-topic --name tenants/test-tenant/namespaces/test-namespace/topics/test-topic-nullable --force
echo ""

echo -e "${GREEN}Deleting namespace (must be deleted before object stores and data lakes)...${NC}"
bun run airfoil:dev cluster delete-namespace --name tenants/test-tenant/namespaces/test-namespace --force
echo ""

echo -e "${GREEN}Deleting data lakes...${NC}"
bun run airfoil:dev cluster delete-data-lake --name tenants/test-tenant/data-lakes/test-iceberg-lake --force
bun run airfoil:dev cluster delete-data-lake --name tenants/test-tenant/data-lakes/test-parquet-lake --force
echo ""

echo -e "${GREEN}Deleting object stores...${NC}"
bun run airfoil:dev cluster delete-object-store --name tenants/test-tenant/object-stores/test-aws-store --force
bun run airfoil:dev cluster delete-object-store --name tenants/test-tenant/object-stores/test-azure-store --force
bun run airfoil:dev cluster delete-object-store --name tenants/test-tenant/object-stores/test-google-store --force
bun run airfoil:dev cluster delete-object-store --name tenants/test-tenant/object-stores/test-s3-store --force
echo ""

echo -e "${GREEN}Deleting tenant...${NC}"
bun run airfoil:dev cluster delete-tenant --name tenants/test-tenant --force
echo ""

echo -e "${BLUE}=== ALL TESTS COMPLETED SUCCESSFULLY ===${NC}"

