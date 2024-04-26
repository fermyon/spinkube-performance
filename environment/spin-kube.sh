#!/bin/bash
set -euo pipefail

source $(dirname $(realpath "$0"))/../utils.sh

SHIM_VERSION=${SHIM_VERSION:-v0.13.1}
DATADOG_API_KEY=${DATADOG_API_KEY:-''}
READINESS_TIMEOUT=${READINESS_TIMEOUT:-20s}

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
    --set nodeSelector.workload=system \
    --set cainjector.nodeSelector.workload=system \
    --set startupapicheck.nodeSelector.workload=system \
    --set webhook.nodeSelector.workload=system \
    --version v1.14.3

  # Wait for cert-manager to be ready
  kubectl wait --for=condition=available --timeout=${READINESS_TIMEOUT} deployment/cert-manager-webhook -n cert-manager
}

install_datadog() {
  if [[ -z "${DATADOG_API_KEY}" ]]; then
    echo "WARNING: DATADOG_API_KEY is empty; skipping datadog installation"
  else
    # Add and update the Datadog repository
    helm repo add datadog https://helm.datadoghq.com
    helm repo update

    # Install the datadog chart
    #
    # Note: the datadog.kubelet config avoids 'unable to reliably determine the host name.' when running on AKS.
    # Another option is to set 'kubelet.tlsVerif=false'
    # Ref https://docs.datadoghq.com/containers/kubernetes/distributions/?tab=helm#aks-kubelet-certificate
    # TODO: this configuration may not be applicable to other clusters/distros and may break installation
    #
    # Note: also possible to supply a secret for the API key
    # https://github.com/DataDog/helm-charts/tree/main/charts/datadog#create-and-provide-a-secret-that-contains-your-datadog-api-and-app-keys
    #
    # Note: we set the nodeSelector for all components to run on the system nodes EXCEPT
    # the agents, as we of course need an agent present on the apps node to capture data
    # and forward on to Datadog
    helm upgrade --install datadog \
      --namespace datadog \
      --create-namespace \
      --set clusterAgent.nodeSelector.workload=system \
      --set clusterChecksRunner.nodeSelector.workload=system \
      --set kube-state-metrics.nodeSelector.workload=system \
      --set datadog.kubelet.host.valueFrom.fieldRef.fieldPath=spec.nodeName \
      --set datadog.kubelet.hostCAPath=/etc/kubernetes/certs/kubeletserver.crt \
      --set datadog.apiKey="${DATADOG_API_KEY}" datadog/datadog
    fi
}

install_kwasm_operator() {
  # Add Helm repository if not already done
  helm repo add kwasm http://kwasm.sh/kwasm-operator/

  # Install KWasm operator
  helm upgrade --install \
    kwasm-operator kwasm/kwasm-operator \
    --namespace kwasm \
    --create-namespace \
    --set nodeSelector.workload=system \
    --set "kwasmOperator.installerImage=ghcr.io/spinkube/containerd-shim-spin/node-installer:$SHIM_VERSION"

  # Provision Nodes labeled with 'runtime=containerd-shim-spin'
  # Other nodes may have different labels/purposes and we may not want apps to run there
  kubectl annotate node -l runtime=containerd-shim-spin kwasm.sh/kwasm-node=true
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
    --set nodeSelector.workload=system \
    --set namespace.create=false

  # Wait for k6-operator deployment to be ready
  kubectl wait --for=condition=available --timeout=${READINESS_TIMEOUT} deployment/k6-operator-controller-manager -n k6
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
  kubectl wait --for=condition=available --timeout=${READINESS_TIMEOUT} deployment/spin-operator-controller-manager -n spin-operator
}
