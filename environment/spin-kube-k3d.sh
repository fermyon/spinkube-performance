#!/bin/bash
set -euo pipefail

source $(dirname $(realpath "$0"))/spin-kube.sh

CLUSTER_NAME="test-cluster"
SHIM_VERSION=${1:-v0.13.1}
NODE_IP=${2:-""}
HOST_PORT=8081

# List of binary names
binaries=("k3d" "kubectl" "helm")

for binary in "${binaries[@]}"; do
  which_binary "$binary"
done

# If node IP is set, script is being run on another machine
cluster_args=("--port $HOST_PORT:80@loadbalancer" "--image ghcr.io/spinkube/containerd-shim-spin/k3d:$SHIM_VERSION" "--agents 1")
if [[ -n "$NODE_IP" ]]; then
  # Add remote host's IP as a SAN for the servers and agents certificates
  cluster_args=(
    "--k3s-arg --write-kubeconfig-mode=0644@server:0"
    "--k3s-arg --tls-san=$NODE_IP@server:0"
    "--k3s-arg --tls-san=0.0.0.0@server:0"
    '--k3s-arg --kube-controller-manager-arg='bind-address=0.0.0.0'@server:0'
    '--k3s-arg --kube-proxy-arg='metrics-bind-address=0.0.0.0'@server:0'
    '--k3s-arg --kube-scheduler-arg='bind-address=0.0.0.0'@server:0'
  )
fi

k3d cluster create $CLUSTER_NAME ${cluster_args[@]}

install_cert_manager
install_k6_operator
install_spin_operator

# Generate kubeconfig at $HOME/.kube/config
k3d kubeconfig write test-cluster -o $HOME/.kube/config