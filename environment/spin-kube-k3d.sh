#! /bin/bash
set -euo

CLUSTER_NAME="test-cluster"
SHIM_VERSION=${1:-v0.13.1}
NODE_IP=${2:-""}
HOST_PORT=8081

# Function: which_binary
# Description:
# Finds and prints the path of the specified binary if it exists in the system's PATH.
# If the binary is not found, it prints an error message.
# Parameters:
# $1 - The name of the binary to locate.
which_binary() {
  local binary_name="$1"
  local binary_path
  binary_path=$(command -v "$binary_name")
  if [[ -n "$binary_path" ]]; then
    echo "$binary_path"
  else
    echo "Could not find $binary_name" >&2
    exit 1
  fi
}

# List of binary names
binaries=("k3d" "kubectl" "helm")

for binary in "${binaries[@]}"; do
  which_binary "$binary"
done

# If node IP is set, script is being run on another machine
cluster_args=("--port $HOST_PORT:80@loadbalancer" "--agents 1")
if [[ -n "$NODE_IP" ]]; then
  # Add remote host's IP as a SAN for the servers and agents certificates
  cluster_args=(
    "--image ghcr.io/spinkube/containerd-shim-spin/k3d:$SHIM_VERSION"
    "--port $HOST_PORT:80@loadbalancer"
    "--agents 1"
    "--k3s-arg --write-kubeconfig-mode=0644@server:0"
    "--k3s-arg --tls-san=$NODE_IP@server:0"
    "--k3s-arg --tls-san=0.0.0.0@server:0"
    '--k3s-arg --kube-controller-manager-arg='bind-address=0.0.0.0'@server:0'
    '--k3s-arg --kube-proxy-arg='metrics-bind-address=0.0.0.0'@server:0'
    '--k3s-arg --kube-scheduler-arg='bind-address=0.0.0.0'@server:0'
  )
fi

k3d cluster create $CLUSTER_NAME ${cluster_args[@]}


# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.3/cert-manager.yaml

# Apply Spin runtime class
kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.runtime-class.yaml

# Apply Spin CRDs
kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.crds.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=20s deployment/cert-manager-webhook -n cert-manager

# Install Spin Operator with Helm
helm install spin-operator \
  --namespace spin-operator \
  --create-namespace \
  --version 0.1.0 \
  --wait \
  oci://ghcr.io/spinkube/charts/spin-operator

# Add the shim executor for the Spin operator
kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.shim-executor.yaml

# Wait for the Spin Operator to be ready
kubectl wait --for=condition=available --timeout=60s deployment/spin-operator-controller-manakger -n spin-operator

# Generate kubeconfig at $HOME/.kube/config
k3d kubeconfig write test-cluster -o $HOME/.kube/config