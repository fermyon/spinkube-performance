#!/bin/bash
set -euo pipefail

source $(dirname $(realpath "$0"))/../utils.sh

SHIM_VERSION=${SHIM_VERSION:-v0.13.1}

install_cert_manager() {
  # Install cert-manager CRDs
  kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.3/cert-manager.crds.yaml

  # Add and update Jetstack repository
  helm repo add jetstack https://charts.jetstack.io
  helm repo update

  # Install the cert-manager Helm chart
  helm upgrade --install \
    cert-manager jetstack/cert-manager \
    --namespace cert-manager \
    --create-namespace \
    --version v1.14.3

  # Wait for cert-manager to be ready
  kubectl wait --for=condition=available --timeout=20s deployment/cert-manager-webhook -n cert-manager
}

install_kwasm_operator() {
  # Add Helm repository if not already done
  helm repo add kwasm http://kwasm.sh/kwasm-operator/

  # Install KWasm operator
  helm upgrade --install \
    kwasm-operator kwasm/kwasm-operator \
    --namespace kwasm \
    --create-namespace \
    --set "kwasmOperator.installerImage=ghcr.io/spinkube/containerd-shim-spin/node-installer:$SHIM_VERSION"

  # Provision Nodes
  kubectl annotate node --all kwasm.sh/kwasm-node=true
}

install_k6_operator() {
  # Add and update the Grafana chart repository
  helm repo add grafana https://grafana.github.io/helm-charts
  helm repo update

  # Install the k6-operator Helm chart
  # Note: the chart also attempts to create the namespace by default
  # so we set namespace.create=false to ensure only Helm attempts creation
  helm upgrade --install \
    k6-operator grafana/k6-operator \
    --namespace k6 \
    --create-namespace \
    --set namespace.create=false

  # Wait for k6-operator deployment to be ready
  kubectl wait --for=condition=available --timeout=20s deployment/k6-operator-controller-manager -n k6
}

install_spin_operator() {
  # Apply Spin runtime class
  kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.runtime-class.yaml

  # Apply Spin CRDs
  kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.crds.yaml

  # Install Spin Operator with Helm
  helm upgrade --install spin-operator \
    --namespace spin-operator \
    --create-namespace \
    --version 0.1.0 \
    --wait \
    oci://ghcr.io/spinkube/charts/spin-operator

  # Add the shim executor for the Spin operator
  kubectl apply -f https://github.com/spinkube/spin-operator/releases/download/v0.1.0/spin-operator.shim-executor.yaml

  # Wait for the Spin Operator to be ready
  kubectl wait --for=condition=available --timeout=20s deployment/spin-operator-controller-manager -n spin-operator
}
