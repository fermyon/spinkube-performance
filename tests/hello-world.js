import http from 'k6/http';
import { check } from 'k6';
import { Kubernetes } from 'k6/x/kubernetes';
import * as deploy from "./common/common.js";
import { sleep } from 'k6';

export let options = {
  stages: [
    { target: 200, duration: '10s' },
    { target: 0, duration: '10s' },
  ],
};

function applySpinApp(kubernetes, testConfig) {
  let spinApp = new deploy.SpinApp(
    testConfig.name,
    {
      "image": testConfig.image,
      "replicas": testConfig.replicas,
      "executor": testConfig.executor
    }
  );
  console.log("Creating SpinApp: " + JSON.stringify(spinApp));
  kubernetes.create(spinApp);
}


/**
 * Setup function that is executed before the test starts.
 * It applies the SpinApp custom resource to the Kubernetes cluster.
 * @returns {string} The URL to be used for the test.
 */
export function setup() {
  console.log("Setting up test")
  const kubernetes = new Kubernetes();
  let testConfig = deploy.test_config_from_env();
  applySpinApp(kubernetes, testConfig);
  const timeout = 60;
  if (deploy.waitAllAppsReady(kubernetes, timeout, testConfig.namespace, testConfig.replicas) === -1) {
    console.error(`SpinApp not ready after ${timeout} seconds`);
    return;
  }
  return testConfig;
}

/**
 * Main function that is executed during the test.
 * It sends an HTTP GET request to the specified URL and performs a check on the response status.
 * @param {string} data - The URL to send the request to.
 */
export default function (testConfig) {
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
