#! /bin/bash

set -euo

SHIM_VERSION=${1:-v0.13.1}
NODE_IP=${2:-""}

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
binaries=("kubectl" "helm")

for binary in "${binaries[@]}"; do
  which_binary "$binary"
done

cluster_args=()
# If node IP is set, script is being run on another machine
if [[ -n "$NODE_IP" ]]; then
  # Add remote host's IP as a SAN for the servers and agents certificates
  cluster_args=(
  "--tls-san=$NODE_IP"
  "--tls-san=0.0.0.0"
  '--kube-controller-manager-arg 'bind-address=0.0.0.0''
  '--kube-proxy-arg 'metrics-bind-address=0.0.0.0'' '--kube-scheduler-arg 'bind-address=0.0.0.0''
  )
fi
# Install k3s making the kubeconfig readable (https://docs.k3s.io/installation/configuration)
curl -sfL https://get.k3s.io | sh -s - server --write-kubeconfig-mode '0644' ${cluster_args[@]}

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Apply Spin runtime class
kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.runtime-class.yaml

# Apply Spin CRDs
kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.crds.yaml

# Install cert-manager CRDs
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.3/cert-manager.crds.yaml

# Add and update Jetstack repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install the cert-manager Helm chart
helm install \
  cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.14.3

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=20s deployment/cert-manager-webhook -n cert-manager

# Add Helm repository if not already done
helm repo add kwasm http://kwasm.sh/kwasm-operator/

# Install KWasm operator
helm install \
  kwasm-operator kwasm/kwasm-operator \
  --namespace kwasm \
  --create-namespace \
  --set "kwasmOperator.installerImage=ghcr.io/spinkube/containerd-shim-spin/node-installer:$SHIM_VERSION"

# Re-export kubeconfig as kwasm operator may restart the k3s process 
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Provision Nodes
kubectl annotate node --all kwasm.sh/kwasm-node=true

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
kubectl wait --for=condition=available --timeout=20s deployment/spin-operator-controller-manager -n spin-operator

