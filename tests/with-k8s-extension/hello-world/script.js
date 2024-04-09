import http from 'k6/http';
import { check } from 'k6';
import { Kubernetes } from 'k6/x/kubernetes';
import { SharedArray } from 'k6/data';
import { sleep } from 'k6';

/**
 * Resource representing a SpinApp deployment configuration.
 * @type {object}
 */
class SpinApp {
  constructor(name, spec) {
      this.apiVersion = "core.spinoperator.dev/v1alpha1";
      this.kind = "SpinApp";
      this.metadata = { name };
      this.spec = spec;
  }
}

/**
 * Resource representing the Ingress configuration.
 * @type {object}
 */
class Ingress {
  constructor(name, port = 80) {
      this.apiVersion = "networking.k8s.io/v1";
      this.kind = "Ingress";
      this.metadata = {
          name,
          annotations: {
              "ingress.kubernetes.io/ssl-redirect": "false"
          }
      };
      this.spec = {
          rules: [
              {
                  http: {
                      paths: [
                          {
                              path: "/",
                              pathType: "Prefix",
                              backend: {
                                  service: {
                                      name,
                                      port: {
                                          number: port
                                      }
                                  }
                              }
                          }
                      ]
                  }
              }
          ]
      };
  }
}

/**
 * SharedArray containing the test configuration.
 * @type {SharedArray}
 */
const testConfig = new SharedArray('app deployment', function () {
  let path = `${__ENV.TEST_CONFIG_PATH}` != "undefined" ? `${__ENV.TEST_CONFIG_PATH}` : 'config.json';
  console.log(path);
  let config = JSON.parse(open(path));
  console.log("config is ", config);
  // IFF a test case ID is provided, filter the config to only include the test case with that ID
  if (`${__ENV.TESTCASE_NAME}` != "undefined") {
    config = config.filter((item) => item.name === `${__ENV.TESTCASE_NAME}`);
  }
  console.log(config);
  return config; // must be an array
});

/**
 * Setup function that is executed before the test starts.
 * It applies the SpinApp and Ingress configurations to the Kubernetes cluster.
 * @returns {string} The URL to be used for the test.
 */
export function setup() {
  console.log("setting up test ...")
  let executor = `${__ENV.EXECUTOR}`;
  const kubernetes = new Kubernetes({
    // config_path: "/tmp/kubeconfig.yaml" // $HOME/.kube/config by default
  });
  // For each entry in the test configuration, create a SpinApp and Ingress resource
  for (let i = 0; i < testConfig.length; i++) {
    let spinApp = new SpinApp(
      testConfig[i].name,
      {
          "image": testConfig[i].image,
          "replicas": testConfig[i].replicas || 1,
          "executor": executor
      }
    );
    let ingress = new Ingress(testConfig[i].name, 80);
    console.log("creating resources ...")
    console.log(spinApp);
    console.log(ingress);
    kubernetes.create(spinApp);
    kubernetes.create(ingress);
  }

  // Wait for apps to be running
  const timeout = 10;
  if (!waitAllAppsReady(kubernetes, timeout)) {
      console.log(`"pods not ready after ${timeout} seconds`)
  }
  // Sleep to let resources settle
  // sleep(1);

  // TODO: this should be a list of all endpoints once more ports are exposed on the cluster
  // For k3d, make port 8081
  return `http://${__ENV.NODE_IP}:80/hello`;
}

function waitAllAppsReady(kubernetes, duration_sec) {
  let now = new Date().getTime();
  let end = now + duration_sec * 1000;
  while (now < end) {
    let spinapps = kubernetes.list("SpinApp.core.spinoperator.dev", "default");
    const notReadyApps = spinapps.filter((app) => app.status.conditions[0].status != 'True');
    if (notReadyApps.length === 0) {
      return true;
    }
    now = new Date().getTime();
  }
  return false;
}

/**
 * Main function that is executed during the test.
 * It sends an HTTP GET request to the specified URL and performs a check on the response status.
 * @param {string} data - The URL to send the request to.
 */
export default function(data) {
  const res = http.get(data);
  check(res, {
  "response code was 200": (res) => res.status == 200,
  "body message was 'Hello, World'": (res) => typeof res.body === 'string' && (res.body.trim() == "Hello, World")
  });
  sleep(0.1);
}

/**
 * Teardown function that is executed after the test ends.
 * It deletes the SpinApp and Ingress configurations from the Kubernetes cluster.
 */
export function teardown() {
  const kubernetes = new Kubernetes();
  for (let i = 0; i < testConfig.length; i++) {
    kubernetes.delete("SpinApp.core.spinoperator.dev", testConfig[i].name, "default");
    kubernetes.delete("Ingress.networking.k8s.io", testConfig[i].name, "default");
  }
}
