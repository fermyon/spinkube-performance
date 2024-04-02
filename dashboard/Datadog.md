# Exporting to Datadog

## Installing the Datadog Agent on a K8s Cluster
Install the Datadog cluster agent on your cluster [using Helm](https://docs.datadoghq.com/containers/kubernetes/installation/?tab=helm), which will collect all of these [metrics](https://docs.datadoghq.com/containers/kubernetes/data_collected/):

```sh
helm repo add datadog https://helm.datadoghq.com
helm repo update
# Create a secret for your datadog API key
kubectl create secret generic datadog-secret --from-literal api-key=$DD_API_KEY
```

Create a values file for the chart that specifies the Datadog site and API key.

```yaml
# values.yaml
datadog:
apiKeyExistingSecret: datadog-secret
site: "us5.datadoghq.com"
dogstatsd:
useHostPort: true
```

Now, install the chart with the values file specifying your node OS.

```sh
helm install datadog -f values.yaml --set targetSystem="linux" datadog/datadog
```

## Running the K6 Tests with a Datadog Service Output

Build k6 with the `xk6-output-statsd` extension [as explained in the docs](https://k6.io/docs/results-output/real-time/datadog/). This will output a k6 binary in the root of the repository:

```sh
make k6-build
```

Run the test script specifying "datadog" as the output to ensure [statsd parameters are set in K6](https://k6.io/docs/results-output/real-time/datadog/) and setting the IP address of the node with the Datadog agent:

```sh
./tests/run.sh hello-world $NODE_IP datadog
```