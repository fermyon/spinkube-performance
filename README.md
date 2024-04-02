# SpinKube Performance Test Suite

> WARNING: THIS IS A VERY IN PROGRESS POC

The suite consists of multiple sections:

1. Spin apps
2. JS K6 test scripts
3. Test configuration files (`test-config.json`)
4. Test options files (`options.json`)
5. Environment/cluster set up scripts
6. Datadog dashboard

This guide will help you run the K6 scripts for testing SpinKube deployments.

## Setting Up Your Cluster

Several scripts are provided in the [`environment` directory](./environment/) to help set up your Kubernetes environment. 
After executing, ensure you have access to the cluster by storing the cluster config at `$HOME/.kube/config`.

### Accessing a Remote Cluster

A remote cluster can be accessed by pointing a Kubernetes client to a cluster config (kubeconfig file).

After using one of the [environment installation scripts](./environment/), copy over the config and update the server address to be the remote machine's IP. For example, for K3s:

```sh
scp <user>@<NODE_IP>:/etc/rancher/k3s/k3s.yaml $HOME/.kube/config
sed -i '' 's/127\.0\.0\.1/<NODE_IP>/g' $HOME/.kube/config
```

For K3d, the remote server IP is originally set to `0.0.0.0`, so the text replacement should be slightly modified as follows:

```sh
scp <user>@<NODE_IP>:$HOME/.kube/config $HOME/.kube/config
sed -i '' 's/0\.0\.0\.0/<NODE_IP>/g' $HOME/.kube/config
```

## Executing a Test

Use the [`run.sh`](./tests/run.sh) to execute a test. For now, the script assumes a single node cluster. Specify the node IP address in `NODE_IP`.

```sh
 ./tests/run.sh hello-world $NODE_IP datadog
```

This will start the K6 test, which will create a `SpinApp` and an `Ingress` in your Kubernetes cluster and perform the tests defined in the script. At the end of the test, it will delete the created Kubernetes resources. Test results should be visible in Datadog.

## Creating a Test Configuration File

The test configuration file is a JSON file that contains an array of objects. Each object represents a test case and has the following properties:

- `name`: An identifier for the test case.
- `image`: The SpinApp OCI image to be used for the test.
- `language`: (optional) The language the app is implemented in

There is no maximum number of scenarios that a configuration file can contain. When running a test, the scenario ID is specified in the `TESTCASE_NAME` environment variable, which instructs the K6 test to filter for that entry in the list and deploy those resources. See the [hello-world test configuration](./tests/hello-world/test-config.json) for an example.