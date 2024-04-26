import http from 'k6/http';
import { check } from 'k6';
import { Kubernetes } from 'k6/x/kubernetes';
import * as deploy from "./common/common.js";
import { Trend, Counter } from 'k6/metrics';
import exec from 'k6/execution';
import { sleep } from 'k6';

export let options = {
  stages: [
    { target: 200, duration: '10s' }
  ],
  setupTimeout: '120s',
};

const timeToDeployTenApps = new Trend('time_to_deploy_ten_apps');
const deployedApps = new Counter('deployed_apps');
const waitAppsReadyTimeout = 120;

class TestEndpoint {
  constructor(name, endpoint) {
    this.name = name;
    this.endpoint = endpoint;
  }
}

function createSpinApps(imagePrefix, batchNumber, batchSize, testConfig) {
  console.log(`Creating ${batchSize} SpinApp custom resources`)
  let apps = [];
  for (let i = 0; i < batchSize; i++) {
    console.log(`Creating SpinApp ${testConfig.name}-${i}`);
      let image = `${imagePrefix}${batchNumber * batchSize + i + 1}:latest`;
      let app = new deploy.SpinApp(
        `${testConfig.name}-${i}`,
        {
          "image": image,
          "replicas": testConfig.replicas,
          "executor": testConfig.executor
        }
      );
      apps.push(app);
  }
  return apps;
}

function applySpinApps(kubernetes, spinApps, testConfig) {
  console.log(`Applying ${spinApps.length} SpinApp custom resources to the cluster`)
  let endpoints = [];
  let i
  for (i = 0; i < spinApps.length; i++) {
    console.log("Creating SpinApp: " + JSON.stringify(spinApps[i]));
    kubernetes.create(spinApps[i]);
    let svc = deploy.serviceEndpointForApp(spinApps[i].metadata.name, testConfig.namespace, "");
    endpoints.push(new TestEndpoint(spinApps[i].metadata.name, svc));
  }
  const timeToReady = deploy.waitAllAppsReady(kubernetes, waitAppsReadyTimeout, testConfig.namespace, testConfig.replicas);
  if (timeToReady === -1) {
    exec.test.abort(`SpinApps not ready after ${waitAppsReadyTimeout} seconds after deploying ${i - 1} apps`);
  }
  timeToDeployTenApps.add(timeToReady);
  deployedApps.add(spinApps.length);
  return endpoints;
}

/**
 * Setup function that is executed before the test starts.
 * It applies the SpinApp custom resource to the Kubernetes cluster.
 * @returns {string} The URL to be used for the test.
 */
export function setup() {
  console.log("Setting up test")
  const kubernetes = new Kubernetes();
  let baseTestConfig = deploy.test_config_from_env();
  let baseOciEndpoint = `${__ENV.REGISTRY_BASE}` != "undefined" ? `${__ENV.REGISTRY_BASE}` : "rg.fr-par.scw.cloud/dlancshire-public/template-app-";
  let batchSize = `${__ENV.BATCH_SIZE}` != "undefined" ? `${__ENV.BATCH_SIZE}` : 10;
  let batchNumber = baseTestConfig.name.includes("density") ? parseInt(baseTestConfig.name.split("-")[1]) : 0;
  let apps = createSpinApps(baseOciEndpoint, batchNumber, batchSize, baseTestConfig);
  console.log(`Density test configured for batch ${batchNumber} of ${batchSize} apps`);
  let endpoints = applySpinApps(kubernetes, apps, baseTestConfig);
  sleep(10);
  return endpoints;
}

/**
 * Main function that is executed during the test.
 * It sends an HTTP GET request to the specified URL and performs a check on the response status.
 * @param {string} data - The URL to send the request to.
 */
export default function(endpoints) {
  const response = http.batch(endpoints.map((endpoint) => ({
    method: 'GET',
    url: endpoint.endpoint,
  })));
  for (let j = 0; j < response.length; j++) {
    check(response[j], {
      "response code was 200": (res) => res.status == 200,
      "body message started with 'Hello'": (res) => typeof res.body === 'string' && (res.body.trim().includes("Hello"))
    });
  }
  sleep(0.1);
}

/**
 * Teardown function that is executed after the test ends.
 * It deletes the SpinApp custom resource from the Kubernetes cluster.
 */
export function teardown(endpoints) {
  // SKIPPED: as this test is often run multiple times to build up density
  console.log("Skipping teardown for density test")
  // let namespace = `${__ENV.NAMESPACE}` != "undefined" ? `${__ENV.NAMESPACE}` : "default";
  // const kubernetes = new Kubernetes();
  // for (let i = 0; i < endpoints.length; i++) {
  //   kubernetes.delete("SpinApp.core.spinoperator.dev", endpoints[i].name, namespace);
  // }
}
