#!/bin/bash
set -euo pipefail

source $(dirname $(realpath "$0"))/spin-kube.sh

for binary in kubectl helm; do
  which_binary "$binary"
done

OUTPUT=${OUTPUT:-"datadog"}

install_cert_manager
install_k6_operator
install_kwasm_operator
install_spin_operator

if [[ "${OUTPUT}" == "datadog" ]]; then
  install_datadog
elif [[ "${OUTPUT}" == "prometheus" ]]; then
  install_kube_prometheus
fi