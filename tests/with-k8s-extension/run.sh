#!/bin/bash

TEST=${1:-"hello-world"}
NODE_IP=${2:-"localhost"}
OUTPUT=${3:-"datadog"}
EXECUTOR=${4:-"containerd-shim-spin"}
NO_TEARDOWN=${5:-""}
# Navigate to the directory containing the script
path="$(dirname "$0")/$TEST"
echo "path is $path"

test_config_json=$(cat $path/test-config.json)

# Loop through each entry in the JSON array
for entry in $(echo "$test_config_json" | jq -r '.[] | @base64'); do
    # Decode the base64 entry
    _jq() {
     echo ${entry} | base64 --decode | jq -r ${1}
    }

    # Extract values
    ID=$(_jq '.name')
    language=$(_jq '.language')

    # Run command with the appropriate output
    if [ "$OUTPUT" == "prometheus" ];
    then
        echo "Running with Prometheus output"
        # Run the command - Output to Prometheus
        K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
        K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true \
        K6_PROMETHEUS_RW_TREND_STATS='p(99),p(50),min,max,avg' \
        EXECUTOR=$EXECUTOR \
        TESTCASE_NAME=$ID \
        TEST_CONFIG_PATH=test-config.json \
        NODE_IP=$NODE_IP \
        ./k6 run -o experimental-prometheus-rw --config $path/options.json --tag language=$language $path/script.js $NO_TEARDOWN
    elif [ "$OUTPUT" == "datadog" ];
    then
        echo "Running with Datadog output"
        statsd_addr=$NODE_IP:8125
        K6_STATSD_ADDR=$statsd_addr \
        K6_STATSD_ENABLE_TAGS=true \
        EXECUTOR=$EXECUTOR \
        TESTCASE_NAME=$ID \
        TEST_CONFIG_PATH=test-config.json \
        NODE_IP=$NODE_IP \
        ./k6 run --out output-statsd --config $path/options.json --tag language=$language $path/script.js $NO_TEARDOWN
    else
        echo "Running with no output"
        EXECUTOR=$EXECUTOR \
        TESTCASE_NAME=$ID \
        TEST_CONFIG_PATH=test-config.json \
        NODE_IP=$NODE_IP \
        ./k6 run --config $path/options.json --tag language=$language $path/script.js $NO_TEARDOWN
    fi

    # Sleep between iterations
    sleep 3
done
