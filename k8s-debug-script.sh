#!/bin/bash

# Kubernetes Debug Script for Runflare Deployment
# Namespace: dreammaker
# Deployment: test-kww-deploy
# Ingress: test-unp-ingress
# PVC: test-lrk-claim

echo "=========================================="
echo "🚀 Kubernetes Deployment Debug Script"
echo "=========================================="
echo "Namespace: dreammaker"
echo "Deployment: test-kww-deploy"
echo "Ingress: test-unp-ingress"
echo "PVC: test-lrk-claim"
echo "=========================================="
echo

# Step 1: Check Pod Status
echo "📋 STEP 1: Checking Pod Status"
echo "------------------------------------------"

# List all pods in the namespace
echo "🔍 Listing all pods in dreammaker namespace:"
kubectl get pods -n dreammaker

echo
echo "🔍 Getting pod details with wide output:"
kubectl get pods -n dreammaker -o wide

echo
echo "🔍 Describing pods (will show events and detailed status):"
POD_NAMES=$(kubectl get pods -n dreammaker --no-headers -o custom-columns=":metadata.name" 2>/dev/null)
if [ -n "$POD_NAMES" ]; then
    for pod in $POD_NAMES; do
        echo "--- Describing pod: $pod ---"
        kubectl describe pod $pod -n dreammaker
        echo
    done
else
    echo "⚠️  No pods found in dreammaker namespace"
fi

echo
echo "🔍 Checking recent logs from pods:"
if [ -n "$POD_NAMES" ]; then
    for pod in $POD_NAMES; do
        echo "--- Logs from pod: $pod (last 50 lines) ---"
        kubectl logs $pod -n dreammaker --tail=50
        echo
    done
else
    echo "⚠️  No pods found to check logs"
fi

echo
echo "=========================================="

# Step 2: Check Deployment & ReplicaSet
echo "📋 STEP 2: Checking Deployment & ReplicaSet"
echo "------------------------------------------"

# Check deployment status
echo "🔍 Checking deployment status:"
kubectl get deploy test-kww-deploy -n dreammaker

echo
echo "🔍 Describing deployment (shows replica status, conditions, events):"
kubectl describe deploy test-kww-deploy -n dreammaker

echo
echo "🔍 Listing all ReplicaSets in namespace:"
kubectl get rs -n dreammaker

echo
echo "🔍 Describing ReplicaSets:"
RS_NAMES=$(kubectl get rs -n dreammaker --no-headers -o custom-columns=":metadata.name" 2>/dev/null)
if [ -n "$RS_NAMES" ]; then
    for rs in $RS_NAMES; do
        echo "--- Describing ReplicaSet: $rs ---"
        kubectl describe rs $rs -n dreammaker
        echo
    done
else
    echo "⚠️  No ReplicaSets found in dreammaker namespace"
fi

echo
echo "=========================================="

# Step 3: Check PVC & Volume
echo "📋 STEP 3: Checking PVC & Volume"
echo "------------------------------------------"

# Check PVC status
echo "🔍 Checking PVC status:"
kubectl get pvc test-lrk-claim -n dreammaker

echo
echo "🔍 Describing PVC (shows binding status, events):"
kubectl describe pvc test-lrk-claim -n dreammaker

echo
echo "🔍 Listing all Persistent Volumes:"
kubectl get pv

echo
echo "🔍 Describing Persistent Volumes:"
PV_NAMES=$(kubectl get pv --no-headers -o custom-columns=":metadata.name" 2>/dev/null)
if [ -n "$PV_NAMES" ]; then
    for pv in $PV_NAMES; do
        echo "--- Describing PV: $pv ---"
        kubectl describe pv $pv
        echo
    done
else
    echo "⚠️  No Persistent Volumes found"
fi

echo
echo "=========================================="

# Step 4: Check Ingress & Service
echo "📋 STEP 4: Checking Ingress & Service"
echo "------------------------------------------"

# Check ingress status
echo "🔍 Checking ingress status:"
kubectl get ingress test-unp-ingress -n dreammaker

echo
echo "🔍 Describing ingress (shows rules, backend services, events):"
kubectl describe ingress test-unp-ingress -n dreammaker

echo
echo "🔍 Listing all services in namespace:"
kubectl get svc -n dreammaker

echo
echo "🔍 Describing services:"
SVC_NAMES=$(kubectl get svc -n dreammaker --no-headers -o custom-columns=":metadata.name" 2>/dev/null)
if [ -n "$SVC_NAMES" ]; then
    for svc in $SVC_NAMES; do
        echo "--- Describing service: $svc ---"
        kubectl describe svc $svc -n dreammaker
        echo
    done
else
    echo "⚠️  No services found in dreammaker namespace"
fi

echo
echo "=========================================="

# Step 5: External Access Test
echo "📋 STEP 5: External Access Test"
echo "------------------------------------------"

# Extract external domain from ingress
echo "🔍 Extracting external domain from ingress:"
INGRESS_HOST=$(kubectl get ingress test-unp-ingress -n dreammaker -o jsonpath='{.spec.rules[0].host}' 2>/dev/null)
INGRESS_HOSTS=$(kubectl get ingress test-unp-ingress -n dreammaker -o jsonpath='{.spec.rules[*].host}' 2>/dev/null)

if [ -n "$INGRESS_HOST" ]; then
    echo "✅ Primary ingress host: $INGRESS_HOST"
    if [ -n "$INGRESS_HOSTS" ]; then
        echo "📋 All ingress hosts: $INGRESS_HOSTS"
    fi
    
    echo
    echo "🌐 Testing external connectivity:"
    echo "Run the following command to test HTTPS connectivity:"
    echo "curl -v https://$INGRESS_HOST"
    echo
    echo "Run the following command to test HTTP connectivity (if applicable):"
    echo "curl -v http://$INGRESS_HOST"
    echo
    echo "🔧 If not reachable, check:"
    echo "  1. DNS propagation: nslookup $INGRESS_HOST"
    echo "  2. Firewall rules on your cluster"
    echo "  3. Load balancer configuration"
    echo "  4. SSL certificate status"
    echo "  5. Ingress controller logs"
    
else
    echo "⚠️  No ingress host found. Checking ingress configuration..."
    kubectl get ingress test-unp-ingress -n dreammaker -o yaml
fi

echo
echo "🔍 Additional connectivity checks:"
echo "Check ingress controller pods and logs:"
echo "kubectl get pods -n ingress-nginx"
echo "kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50"

echo
echo "Check cluster external IP/LoadBalancer:"
kubectl get svc -A | grep -i loadbalancer
kubectl get svc -A | grep -i nodeport

echo
echo "=========================================="
echo "✅ Debug script completed!"
echo "=========================================="
echo
echo "📋 Summary Commands for Quick Reference:"
echo "kubectl get pods,svc,ingress,pvc -n dreammaker"
echo "kubectl get events -n dreammaker --sort-by='.lastTimestamp'"
echo "kubectl top pods -n dreammaker"
echo "kubectl get nodes -o wide"
echo
echo "🔧 If issues persist, check:"
echo "  - Cluster resource limits: kubectl top nodes"
echo "  - Network policies: kubectl get networkpolicy -n dreammaker"
echo "  - RBAC permissions: kubectl auth can-i --list -n dreammaker"