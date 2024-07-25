# Exporting to Datadog

## Installing the Datadog Agent on a K8s Cluster

Install the Datadog cluster agent on your cluster [using Helm](https://docs.datadoghq.com/containers/kubernetes/installation/?tab=helm), which will collect all of these [metrics](https://docs.datadoghq.com/containers/kubernetes/data_collected/).

Configure your Datadog API key and install the Helm chart as follows:

```sh
# Configure the API key for your Datadog account
export DATADOG_API_KEY="<YOUR DD API KEY>"

# Add and update the Datadog repository
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Install the datadog chart
#
# Note: the datadog.kubelet config avoids 'unable to reliably determine the host name.' when running on AKS.
# Another option is to set 'kubelet.tlsVerif=false'
# Ref https://docs.datadoghq.com/containers/kubernetes/distributions/?tab=helm#aks-kubelet-certificate
# Note: also possible to supply a secret for the API key
# https://github.com/DataDog/helm-charts/tree/main/charts/datadog#create-and-provide-a-secret-that-contains-your-datadog-api-and-app-keys
#
helm upgrade --install datadog \
    --namespace datadog \
    --create-namespace \
    --set datadog.kubelet.host.valueFrom.fieldRef.fieldPath=spec.nodeName \
    --set datadog.kubelet.hostCAPath=/etc/kubernetes/certs/kubeletserver.crt \
    --set datadog.apiKey="${DATADOG_API_KEY}" datadog/datadog
```

## Run Tests with Datadog Output

This ensures K6 is executed with the correct flags to export to Datadog using the statsd protocol.

```sh
OUTPUT=datadog make run-tests
```

## Importing the Custom Datadog Dashboard

Import the [datadog-spinkube-performance-dashboard.json](./datadog-spinkube-performance-dashboard.json) file into Datadog to immediately start visualizing data from a recent test run.
