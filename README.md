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

## Executing a Test with the k6 Operator

1. Install _all the operators_ in the Kubernetes environment you're pointed at after [Setting Up Your Cluster](#setting-up-your-cluster)

    Here we're pointed to a generic Kubernetes cluster and just need to run the [spin-kube-k8s.sh](./environment/spin-kube-k8s.sh) script:

    ```sh
    ./environment/spin-kube-k8s.sh
    ```

1. (Optional) Build and push all of the test apps with your own `REGISTRY_URL`

    ```sh
    export REGISRY_URL=ghcr.io/kate-goldenring/performance
    make build-and-push-apps
    ```

1. Run the tests

    ```sh
    make run-tests
    ```

1. Once the test Pods have `Completed` you can get the results of the tests

    Here we view the logs from the pod corresponding to the `hello-world-rust-1` job:

    ```sh
    kubectl logs -f job/hello-world-rust-1
    ```
    
    Output should look similar to:

    ```sh
         ✓ response code was 200
     ✓ body message was 'Hello, World'

     █ setup

     checks.........................: 100.00% ✓ 39054      ✗ 0
     data_received..................: 2.6 MB  129 kB/s
     data_sent......................: 2.2 MB  110 kB/s
     http_req_blocked...............: avg=19.56µs  min=1.89µs   med=8.94µs   max=37.92ms p(90)=11.68µs  p(95)=12.8µs
     http_req_connecting............: avg=8.27µs   min=0s       med=0s       max=37.71ms p(90)=0s       p(95)=0s
     http_req_duration..............: avg=2.46ms   min=301.71µs med=1.95ms   max=38.38ms p(90)=3.8ms    p(95)=4.98ms
       { expected_response:true }...: avg=2.46ms   min=301.71µs med=1.95ms   max=38.38ms p(90)=3.8ms    p(95)=4.98ms
     http_req_failed................: 0.00%   ✓ 0          ✗ 19527
     http_req_receiving.............: avg=116.57µs min=19.83µs  med=108.82µs max=6.14ms  p(90)=153.71µs p(95)=186.96µs
     http_req_sending...............: avg=41.5µs   min=6.31µs   med=36.68µs  max=1.75ms  p(90)=52.72µs  p(95)=67.84µs
     http_req_tls_handshaking.......: avg=0s       min=0s       med=0s       max=0s      p(90)=0s       p(95)=0s
     http_req_waiting...............: avg=2.3ms    min=266.22µs med=1.79ms   max=38.2ms  p(90)=3.62ms   p(95)=4.77ms
     http_reqs......................: 19527   973.225586/s
     iteration_duration.............: avg=103.14ms min=38.15µs  med=102.67ms max=145.6ms p(90)=104.54ms p(95)=105.78ms
     iterations.....................: 19527   973.225586/s
     vus............................: 19      min=0        max=200
     vus_max........................: 200     min=200      max=200
     ```

## Executing a Test with Automatic Application Configuration

Use the [`run.sh`](./tests/with-k8s-extension/run.sh) script to execute a test that also configures the applications. For now, the script assumes a single node cluster. Specify the node IP address in `NODE_IP`.

```sh
 ./tests/run.sh hello-world $NODE_IP datadog
```

This will start the K6 test, which will create a `SpinApp` and an `Ingress` in your Kubernetes cluster and perform the tests defined in the script. At the end of the test, it will delete the created Kubernetes resources. Test results should be visible in Datadog.

### Creating a Test Configuration File

The test configuration file is a JSON file that contains an array of objects. Each object represents a test case and has the following properties:

- `name`: An identifier for the test case.
- `image`: The SpinApp OCI image to be used for the test.
- `language`: (optional) The language the app is implemented in

There is no maximum number of scenarios that a configuration file can contain. When running a test, the scenario ID is specified in the `TESTCASE_NAME` environment variable, which instructs the K6 test to filter for that entry in the list and deploy those resources. See the [hello-world test configuration](./tests/hello-world/test-config.json) for an example.