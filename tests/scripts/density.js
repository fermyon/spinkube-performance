import http from 'k6/http';
import { check } from 'k6';
import { Kubernetes } from 'k6/x/kubernetes';
import * as deploy from "./common/common.js";
import { Gauge } from 'k6/metrics';
import exec from 'k6/execution';
import { sleep } from 'k6';

const testScriptName = "density";
const replicas = `${__ENV.SK_REPLICAS}` != "undefined" ? parseInt(`${__ENV.SK_REPLICAS}`) : 1; 
const namespace = `${__ENV.SK_NAMESPACE}` != "undefined" ? `${__ENV.SK_NAMESPACE}` : "default";
const executor = `${__ENV.SK_EXECUTOR}` != "undefined" ? `${__ENV.SK_EXECUTOR}` : "containerd-shim-spin";
const repo = `${__ENV.SK_OCI_REPO}` != "undefined" ? `${__ENV.SK_OCI_REPO}` : "spinkubeperf.azurecr.io";
const tag = `${__ENV.SK_OCI_TAG}` != "undefined" ? `${__ENV.SK_OCI_TAG}` : "perf";
const route = `${__ENV.SK_SPIN_APP_ROUTE}` != "undefined" ? `${__ENV.SK_SPIN_APP_ROUTE}` : "";
const maxScenarioDurationSecs = `${__ENV.SK_MAX_SCENARIO_DURATION_SECS}` != "undefined" ? `${__ENV.SK_MAX_SCENARIO_DURATION_SECS}` : 180;
const restIntervalSecs = `${__ENV.SK_REST_INTERVAL_SECONDS}` != "undefined" ? `${__ENV.SK_REST_INTERVAL_SECONDS}` : 10;
const batchSize = `${__ENV.SK_BATCH_SIZE}` != "undefined" ? `${__ENV.SK_BATCH_SIZE}` : 10;

const timeToDeployTenApps = new Gauge(`time_to_deploy_${batchSize}_apps`);
const deployedApps = new Gauge('number_of_apps');

export let options = {
  tags: {
    test: testScriptName
  },
  thresholds: {
    // the rate of successful checks should be higher than 90%
    checks: ['rate>0.90'],
  },
  scenarios: {
    density: {
      executor: 'constant-vus',
      vus: 20,
      duration: '60s',
    }
  },
  setupTimeout: '300s',
  noConnectionReuse: true
};

class TestEndpoint {
  constructor(name, endpoint) {
    this.name = name;
    this.endpoint = endpoint;
  }
}

function createSpinApps(imagePrefix, numDeployed, batchSize) {
  console.log(`Creating ${batchSize} SpinApp custom resources also deployed ${numDeployed} apps`)
  let apps = [];
  for (let i = numDeployed + 1; i < numDeployed + batchSize + 1; i++) {
    console.log(`Creating SpinApp ${testScriptName}-${i}`);
      let image = `${imagePrefix}${i}:${tag}`;
      let app = new deploy.SpinApp(
        `${testScriptName}-${i}`,
        {
          "image": image,
          "replicas": replicas,
          "executor": executor
        }
      );
      apps.push(app);
  }
  return apps;
}

/**
 * Apply the SpinApp custom resources to the Kubernetes cluster.
 * @param {Kubernetes} kubernetes - The Kubernetes client to use.
 * @param {Array} spinApps - The SpinApp custom resources to apply.
 * @returns {number} The time it took for all the apps to be ready.
 */
function applySpinApps(kubernetes, spinApps) {
  console.log(`Applying ${spinApps.length} SpinApp custom resources to the cluster`)
  let i
  for (i = 0; i < spinApps.length; i++) {
    console.log("Creating SpinApp: " + JSON.stringify(spinApps[i]));
    kubernetes.create(spinApps[i]);
  }
  const timeout = maxScenarioDurationSecs - 10 > 0 ? maxScenarioDurationSecs - 10 : 10;
  const timeToReady = deploy.waitAllAppsReady(kubernetes, timeout, namespace, replicas);
  if (timeToReady === -1) {
    exec.test.abort(`SpinApps not ready after ${timeout} seconds after deploying ${i - 1} apps`);
  }
  return timeToReady
}

/**
 * Setup function that is executed before the test starts.
 * It applies the SpinApp custom resource to the Kubernetes cluster.
 * @returns {string} The URL to be used for the test.
 */
export function setup() {
  const kubernetes = new Kubernetes();
  let allApps = deploy.getSpinApps(kubernetes, namespace).length;
  let startQuantity = allApps == 0 ? 0 : allApps;
  console.log(`Deploying ${batchSize} apps to cluster with ${startQuantity} already deployed`);
  let apps = createSpinApps(`${repo}/density-rust-`, startQuantity, batchSize);
  let timeToReady = applySpinApps(kubernetes, apps);
  let totalAppsDeployed = deploy.getSpinApps(kubernetes, namespace).length;
  deployedApps.add(totalAppsDeployed);
  console.log(`Deployed ${totalAppsDeployed} apps`);
  timeToDeployTenApps.add(timeToReady, { number_of_apps: totalAppsDeployed });
  let endpoints = [];
  // TODO: get the number of batches from the Options
  for (let i = 0; i < apps.length; i++) {
    let svc = deploy.serviceEndpointForApp(apps[i].metadata.name, namespace, route);
    endpoints.push(new TestEndpoint(apps[i].metadata.name, svc));
  }
  sleep(restIntervalSecs);
  return {
    totalAppsDeployed : totalAppsDeployed,
    endpoints: endpoints
  };
}

/**
 * Main function that is executed during the test.
 * It sends an HTTP GET request to the specified URL and performs a check on the response status.
 * @param {string} data - The URL to send the request to.
 */
export default function(data) {
  for(let i = 0; i < data.endpoints.length; i++) {
    const res = http.get(data.endpoints[i].endpoint, { tags: {number_of_apps: data.totalAppsDeployed} });
    check(res, {
      "response code was 200": (res) => res.status == 200,
      "body message started with 'Hello'": (res) => typeof res.body === 'string' && (res.body.trim().includes("Hello"))
    });
    sleep(0.1);
  }
}

/**
 * Teardown function that is executed after the test ends.
 * It deletes the SpinApp custom resource from the Kubernetes cluster.
 */
export function teardown() {
  console.log("Skipping teardown for density test");
  // const kubernetes = new Kubernetes();
  // for (let i = 0; i < endpoints.length; i++) {
  //   kubernetes.delete("SpinApp.core.spinkube.dev", endpoints[i].name, namespace);
  // }
}
