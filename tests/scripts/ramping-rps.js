import http from 'k6/http';
import { Kubernetes } from 'k6/x/kubernetes';
import * as deploy from "./common/common.js";
import { sleep } from 'k6';
const testName = "ramping-rps";
const route = "hello"
const replicas = `${__ENV.REPLICAS}` != "undefined" ? parseInt(`${__ENV.REPLICAS}`) : 1;
const namespace = `${__ENV.NAMESPACE}` != "undefined" ? `${__ENV.NAMESPACE}` : "default";
let executor = `${__ENV.EXECUTOR}` != "undefined" ? `${__ENV.EXECUTOR}` : "containerd-shim-spin";
let repo = `${__ENV.REPO}` != "undefined" ? `${__ENV.REPO}` : "ghcr.io/kate-goldenring/performance";
let tag = `${__ENV.TAG}` != "undefined" ? `${__ENV.TAG}` : "latest";
let name = `${__ENV.NAME}` != "undefined" ? `${__ENV.NAME}` : "ramping-rps";
let appToTest = `${__ENV.APP}` != "undefined" ? `${__ENV.APP}` : "hello-world-rust";

export let options = {
  tags: {
    test: testName,
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
  },
  setupTimeout: '300s',
  noConnectionReuse: false,
  discardResponseBodies: true,
  scenarios: {
    ramping_rps: {
      executor: 'ramping-arrival-rate',

      // Start iterations per `timeUnit`
      startRate: 100,

      // Start `startRate` iterations per second
      timeUnit: '1s',

      // Pre-allocate necessary VUs.
      preAllocatedVUs: 50,

      stages: [
        // Start 50 iterations per `timeUnit` for the first 1m.
        { target: 100, duration: '1m' },
        { target: 500, duration: '1m' },
        { target: 1000, duration: '1m' },
        { target: 2000, duration: '1m' },
        { target: 5000, duration: '1m' },
      ],
      maxVUs: 100,
    },
  },
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
  const timeout = 60;
  if (deploy.waitAllAppsReady(kubernetes, timeout, namespace, replicas) === -1) {
    console.error(`SpinApps not ready after ${timeout} seconds`);
    return;
  }
  sleep(20);
  return deploy.serviceEndpointForApp(name, namespace, route);
}

/**
 * Main function that is executed during the test.
 * It sends an HTTP GET request to the specified URL and performs a check on the response status.
 * @param {string} data - The URL to send the request to.
 */
export default function (endpoint) {
  http.get(endpoint, {tags: {
    replicas: replicas,
  }});
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
