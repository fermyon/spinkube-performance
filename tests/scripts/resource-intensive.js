import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { Kubernetes } from 'k6/x/kubernetes';
import * as deploy from "./common/common.js";
import { sleep } from 'k6';

const testScriptName = "resource-intensive";
const replicas = `${__ENV.SK_REPLICAS}` != "undefined" ? parseInt(`${__ENV.SK_REPLICAS}`) : 1; 
const namespace = `${__ENV.SK_NAMESPACE}` != "undefined" ? `${__ENV.SK_NAMESPACE}` : "default";
const executor = `${__ENV.SK_EXECUTOR}` != "undefined" ? `${__ENV.SK_EXECUTOR}` : "containerd-shim-spin";
const repo = `${__ENV.SK_OCI_REPO}` != "undefined" ? `${__ENV.SK_OCI_REPO}` : "spinkubeperf.azurecr.io";
const tag = `${__ENV.SK_OCI_TAG}` != "undefined" ? `${__ENV.SK_OCI_TAG}` : "latest";
const route = `${__ENV.SK_SPIN_APP_ROUTE}` != "undefined" ? `${__ENV.SK_SPIN_APP_ROUTE}` : "";
const delay = `${__ENV.SK_DELAY}` != "undefined" ? `${__ENV.SK_DELAY}` : 0.01;
const appToTest = `${__ENV.SK_SPIN_APP}` != "undefined" ? `${__ENV.SK_SPIN_APP}` : "password-hasher";
const name = `${__ENV.SK_TEST_RUN_NAME}` != "undefined" ? `${__ENV.SK_TEST_RUN_NAME}` : testScriptName;
const testDuration='30s';

// App specific envs
const memoryKib = `${__ENV.SK_HASH_MEMORY_KIB}` != "undefined" ? `${__ENV.SK_HASH_MEMORY_KIB}` : "10000";
const cpuIter = `${__ENV.SK_HASH_CPU_ITER}` != "undefined" ? `${__ENV.SK_HASH_CPU_ITER}` : "50";
const sleepMs = `${__ENV.SK_HASH_SLEEP_MS}` != "undefined" ? `${__ENV.SK_HASH_SLEEP_MS}` : "1000";

export let options = {
  tags: {
    test: testScriptName,
    test_duration: testDuration,
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
  },
  setupTimeout: '300s',
  noConnectionReuse: true,
  discardResponseBodies: true,
  // executor: 'constant-vus', // this is the default executor and implied
  vus: 20,
  duration: testDuration,
};

/**
 * Setup function that is executed before the test starts.
 * It applies the SpinApp custom resource to the Kubernetes cluster.
 * @returns {string} The URL to be used for the test.
 */
export function setup() {
  console.log("Setting up test")
  const kubernetes = new Kubernetes();
  let image = deploy.imageForApp(repo, tag, appToTest);
  deploy.applySpinApp(kubernetes, name, image, replicas, executor, namespace);
  const timeout = 200;
  if (deploy.waitAllAppsReady(kubernetes, timeout, namespace, replicas) === -1) {
    console.error(`SpinApps not ready after ${timeout} seconds`);
    exec.test.abort(`SpinApps not ready after ${timeout} seconds`);
  }
  sleep(20);

  let endpoint = deploy.serviceEndpointForApp(name, namespace, route);
  console.log(`Using endpoint: ${endpoint}`);
  return endpoint;
}

/**
 * Main function that is executed during the test.
 * It sends an HTTP GET request to the specified URL and performs a check on the response status.
 * @param {string} data - The URL to send the request to.
 */
export default function () {
  let endpoint = deploy.serviceEndpointForApp(name, namespace, route);

  let res = http.get(`${endpoint}?mem=${memoryKib}`, { 
    tags: { 
      memory_kib: memoryKib,
    },
  });
  check(res, { "response code was 200": (res) => res.status == 200 }, { memory_kib: memoryKib });
  sleep(delay);
  res = http.get(`${endpoint}?cpuIter=${cpuIter}`, { 
    tags: {
      cpu_iter: cpuIter,
    }, 
  });
  check(res, { "response code was 200": (res) => res.status == 200 }, { cpu_iter: cpuIter });
  sleep(delay);
  res = http.get(`${endpoint}?sleep=${sleepMs}`, { 
    tags: {
      sleep: sleepMs,
    },
  });
  check(res, { "response code was 200": (res) => res.status == 200 }, { sleep_ms: sleepMs });
  sleep(delay);
}

/**
 * Teardown function that is executed after the test ends.
 * It deletes the SpinApp custom resource from the Kubernetes cluster.
 */
export function teardown() {
  console.log("Tearing down test")
  const kubernetes = new Kubernetes();
  kubernetes.delete("SpinApp.core.spinoperator.dev", name, namespace);
}
