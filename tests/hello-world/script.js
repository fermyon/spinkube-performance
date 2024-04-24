import http from 'k6/http';
import { check } from 'k6';
import { Kubernetes } from 'k6/x/kubernetes';
import { sleep } from 'k6';

export let options = {
  stages: [
    { target: 200, duration: '10s' },
    { target: 0, duration: '10s' },
  ],
};

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
 * Resource containing information about the app to be tested 
 * in subsequent test stages and teardown.
 * @type {object}
 */
class TestConfig {
  constructor(name, namespace, endpoint) {
    this.name = name;
    this.namespace = namespace;
    this.endpoint = endpoint;
  }
}

/**
 * Setup function that is executed before the test starts.
 * It applies the SpinApp custom resource to the Kubernetes cluster.
 * @returns {string} The URL to be used for the test.
 */
export function setup() {
  console.log("Setting up test")
  const kubernetes = new Kubernetes();
  let executor = `${__ENV.EXECUTOR}` != "undefined" ? `${__ENV.EXECUTOR}` : "containerd-shim-spin";
  let appName = `${__ENV.SERVICE}`;
  if (appName == "undefined") {
    console.error("SERVICE is not defined in the environment variables.");
    return;
  }
  let image = `${__ENV.IMAGE}`;
  if (image == "undefined") {
    image = `ghcr.io/performance/${appName}:latest`;
    console.log("IMAGE is not defined in the environment variables. Defaulting to " + image);
  }
  let namespace = `${__ENV.NAMESPACE}` != "undefined" ? `${__ENV.NAMESPACE}` : "default";
  let replicas = `${__ENV.REPLICAS}` != "undefined" ? `${__ENV.REPLIAS}` : 1;
  let route = `${__ENV.ROUTE}` != "undefined" ? `${__ENV.ROUTE}` : "";
  let endpoint = `http://${appName}.${namespace}.svc.cluster.local/${route}`;
  let spinApp = new SpinApp(
    appName,
    {
        "image": image,
        "replicas": replicas,
        "executor": executor
    }
  );
  console.log("Creating SpinApp: " + JSON.stringify(spinApp));
  kubernetes.create(spinApp);
  const timeout = 30;
  if (!waitAllAppsReady(kubernetes, timeout, namespace, replicas)) {
      console.error(`SpinApp not ready after ${timeout} seconds`);
      return;
  }

  return new TestConfig(appName, namespace, endpoint);
}

function waitAllAppsReady(kubernetes, duration_sec, namespace, replicas) {
  let now = new Date().getTime();
  let end = now + duration_sec * 1000;
  while (now < end) {
    console.log(`Waiting for ${replicas} replicas of app to be ready`);
    let spinapps = kubernetes.list("SpinApp.core.spinoperator.dev", namespace);
    // List should only contain one SpinApp, so return on first ready SpinApp
    for (let i = 0; i < spinapps.length; i++) {
      if ( spinapps.length == 0 || spinapps[i].status == undefined ) {
        continue;
      }
      if (spinapps[i].status.readyReplicas == replicas) {
        console.log("All apps ready");
        return true;
      }
    }
    now = new Date().getTime();
    sleep(1);
  }
  console.log("All apps not ready after timeout");
  return false;
}

/**
 * Main function that is executed during the test.
 * It sends an HTTP GET request to the specified URL and performs a check on the response status.
 * @param {string} data - The URL to send the request to.
 */
export default function(testConfig) {
  const res = http.get(testConfig.endpoint);
  check(res, {
  "response code was 200": (res) => res.status == 200,
  "body message was 'Hello, World'": (res) => typeof res.body === 'string' && (res.body.trim() == "Hello, World")
  });
  sleep(0.1);
}

/**
 * Teardown function that is executed after the test ends.
 * It deletes the SpinApp custom resource from the Kubernetes cluster.
 */
export function teardown(testConfig) {
  console.log("Tearing down test")
  const kubernetes = new Kubernetes();
  kubernetes.delete("SpinApp.core.spinoperator.dev", testConfig.name, testConfig.namespace);
}
