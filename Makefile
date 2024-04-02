k6-build:
	go install go.k6.io/xk6/cmd/xk6@latest
	xk6 build --with github.com/LeonAdato/xk6-output-statsd --with github.com/grafana/xk6-kubernetes