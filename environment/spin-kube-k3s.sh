#!/bin/bash
set -euo pipefail

source $(dirname $(realpath "$0"))/spin-kube.sh

SHIM_VERSION=${1:-v0.13.1}
NODE_IP=${2:-""}

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

install_cert_manager
install_datadog
install_k6_operator
install_kwasm_operator

# Re-export kubeconfig as kwasm operator may restart the k3s process 
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Provision Nodes
kubectl annotate node --all kwasm.sh/kwasm-node=true

install_spin_operator
