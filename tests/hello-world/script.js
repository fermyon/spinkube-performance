import http from 'k6/http';
import { check } from 'k6';
import { sleep } from 'k6';

export let options = {
  stages: [
    { target: 200, duration: '10s' },
    { target: 0, duration: '10s' },
  ],
};

/**
 * Setup function that is executed before the test starts.
 * @returns {string} The URL to be used for the test.
 */
export function setup() {
  if (`${__ENV.ENDPOINT}` != "undefined" )
  {
    return `${__ENV.ENDPOINT}`;
  }

  let service_name = `${__ENV.SERVICE}`;
  if (service_name == "undefined") {
    console.error("SERVICE is not defined in the environment variables.");
    return;
  }
  let namespace = `${__ENV.NAMESPACE}` != "undefined" ? `${__ENV.NAMESPACE}` : "default";
  let route = `${__ENV.ROUTE}` != "undefined" ? `${__ENV.ROUTE}` : "";
  let endpoint = `http://${service_name}.${namespace}.svc.cluster.local/${route}`;
  return endpoint;
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
