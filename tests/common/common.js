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
export class SpinApp {
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
export class TestConfig {
  constructor(name, namespace, endpoint, replicas, image, executor) {
    this.name = name;
    this.namespace = namespace;
    this.endpoint = endpoint;
    this.replicas = replicas;
    this.image = image;
    this.executor = executor;
  }
}

export function test_config_from_env() {
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
  let endpoint = serviceEndpointForApp(appName, namespace, route);
  return new TestConfig(appName, namespace, endpoint, replicas, image, executor);
}

export function serviceEndpointForApp(appName, namespace, route) {
  let endpoint = `http://${appName}.${namespace}.svc.cluster.local/${route}`;
  return endpoint;
}

export function waitAllAppsReady(kubernetes, duration_sec, namespace, replicas) {
  let now = new Date().getTime();
  let end = now + duration_sec * 1000;
  while (now < end) {
    let spinApps = kubernetes.list("SpinApp.core.spinoperator.dev", namespace);
    console.log(`Waiting for ${spinApps.length} apps to be ready`);
    // List should only contain one SpinApp, so return on first ready SpinApp
    let ready = 0;
    for (let i = 0; i < spinApps.length; i++) {
      if (spinApps.length == 0 || spinApps[i].status == undefined) {
        continue;
      }
      if (spinApps[i].status.readyReplicas == replicas) {
        ready = ready + 1;
      }
      if (ready == spinApps.length) {
        return end - now;
      }
    }
    now = new Date().getTime();
    sleep(1);
  }
  return -1;
}