# Build the k6 binary with the extension
FROM golang:1.20 as builder

RUN go install go.k6.io/xk6/cmd/xk6@latest

RUN xk6 build --with github.com/LeonAdato/xk6-output-statsd --with github.com/grafana/xk6-kubernetes

# Use the operator's base image and override the k6 binary
FROM grafana/k6:latest
COPY --from=builder /go/k6 /usr/bin/k6