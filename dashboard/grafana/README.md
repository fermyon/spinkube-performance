# Exporting to Grafana

## Installing the Prometheus and Grafana Stack on a K8s Cluster

K6 integrates with Grafana to analyze performance test results. You can stream K6 results to many [different backend sources](https://grafana.com/docs/k6/latest/results-output/grafana-dashboards/). Prometheus is targeted using the Prometheus remote write protocol, which is "designed to make it possible to reliably propagate samples in real-time from a sender to a receiver, without loss", as explained in the [specification](https://prometheus.io/docs/concepts/remote_write_spec/).

Grafana, Prometheus, and node exporters can all be installed in a Kubernetes cluster using the [Kube-Prometheus](https://github.com/prometheus-operator/kube-prometheus) stack [Helm chart](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) as follows. Enable the Prometheus remote-write receiver and native histograms to ensure k6 metrics can be received.

```sh
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --set prometheus.prometheusSpec.enableRemoteWriteReceiver=true \
        --set 'prometheus.prometheusSpec.enableFeatures[0]="native-histograms"'
```

> Note: the chart name "prometheus" will become the prefix for all Pod names


## Run Tests with Prometheus Output

This ensures K6 is executed with the correct flags to export to Prometheus using the remote-write protocol.

```sh
OUTPUT=prometheus make run-tests
```

## Importing the Custom Grafana Dashboard

Port forward the Grafana service to access the dashboard:

```sh
kubectl port-forward svc/prometheus-grafana 3000:80
```

Navigate to http://localhost:3000 and login using the default username and password credentials of `admin` and `prom-operator`. The password can be updated with the Helm chart [value](https://github.com/prometheus-community/helm-charts/blob/bc0959503f375cade19ccaa65b609133814a9861/charts/kube-prometheus-stack/values.yaml#L976C18-L976C31).

Import the [grafana-spinkube-performance-dashboard.json](./grafana-spinkube-performance-dashboard.json) file into Grafana to immediately start visualizing data from a recent test run.
