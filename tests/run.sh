#!/bin/bash

TEST=${TEST:-"hello-world"}
NODE_IP=${NODE_IP:-"localhost"}
OUTPUT=${OUTPUT:-"datadog"}
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
    route=$(_jq '.route')
    language=$(_jq '.language')
    port=$(_jq '.port')
    endpoint=http://$NODE_IP:$port/$route

    # Run command with the appropriate output
    if [ "$OUTPUT" == "prometheus" ];
    then
        echo "Running with Prometheus output"
        # Run the command - Output to Prometheus
        K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
        K6_PROMETHEUS_RW_TREND_AS_NATIVE_HISTOGRAM=true \
        K6_PROMETHEUS_RW_TREND_STATS='p(99),p(50),min,max,avg' \
        ./k6 run k6 run --out experimental-prometheus-rw --config $path/options.json --tag language=$language -e ENDPOINT=$endpoint $path/script.js
    elif [ "$OUTPUT" == "datadog" ];
    then
        echo "Running with Datadog output"
        statsd_addr=$NODE_IP:8125
        K6_STATSD_ADDR=$statsd_addr \
        K6_STATSD_ENABLE_TAGS=true \
        ./k6 run --out output-statsd --config $path/options.json --tag language=$language -e ENDPOINT=$endpoint $path/script.js
    else
        echo "Running with no output"
        ./k6 run --config $path/options.json --tag language=$language $path/script.js -e ENDPOINT=$endpoint $NO_TEARDOWN
    fi

    # Sleep between iterations
    sleep 3
done
