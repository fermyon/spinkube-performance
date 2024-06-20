SHELL := /bin/bash

REGISTRY_URL ?= spinkubeperf.azurecr.io
SPIN_V_VERSION ?= 2.5.0

k6-build:
	go install go.k6.io/xk6/cmd/xk6@latest
	xk6 build --with github.com/LeonAdato/xk6-output-statsd --with github.com/grafana/xk6-kubernetes

build-k6-image:
	cd image/k6 && \
	docker build --platform linux/amd64,linux/arm64 -t $(REGISTRY_URL)/k6:latest .

push-k6-image:
	docker push $(REGISTRY_URL)/k6:latest

build-and-push-apps:
	./apps/build-and-push.sh $(REGISTRY_URL)

run-density-test-%:
	bash -c "trap '(echo Logs from Density Test $* && kubectl logs job/density-$*-1)' EXIT; \
		TEST=density \
		SK_TEST_RUN_NAME=density-$* \
		SK_SPIN_APP_ROUTE="" \
		SK_SPIN_VERSION="$(SPIN_V_VERSION)" \
		SK_OCI_TAG="perf" \
		SK_OCI_REPO=$(REGISTRY_URL) \
		./tests/run.sh $(REGISTRY_URL)"

run-density-tests: run-density-test-1 run-density-test-2 run-density-test-3 run-density-test-4 run-density-test-5
	kubectl delete spinapp --all

run-hello-world-test:
	bash -c "trap '(echo Logs from Hello World Test && kubectl logs job/hello-world-1)' EXIT; \
		TEST=hello-world \
		SK_SPIN_APP_ROUTE="hello" \
		SK_OCI_TAG=$(SPIN_V_VERSION) \
		SK_OCI_REPO=$(REGISTRY_URL) \
		SK_REPLICAS=1 \
		./tests/run.sh $(REGISTRY_URL)"

run-password-hasher-test:
	bash -c "trap '(echo Logs from Password Hasher Test && kubectl logs job/password-hasher-1)' EXIT; \
		TEST=password-hasher \
		SK_OCI_TAG=$(SPIN_V_VERSION) \
		SK_OCI_REPO=$(REGISTRY_URL) \
		SK_REPLICAS=1 \
		SK_HASH_MEMORY=1024 \
		SK_HASH_CPU=1 \
		SK_HASH_SLEEP=1000 \
		./tests/run.sh $(REGISTRY_URL)"

run-ramping-vus-test-%:
	bash -c "trap '(echo Logs from Ramp Test && kubectl logs job/ramping-vus-$*-1)' EXIT; \
		TEST=ramping-vus \
		SK_TEST_RUN_NAME=ramping-vus-$* \
		SK_SPIN_APP_ROUTE="hello" \
		SK_OCI_TAG=$(SPIN_V_VERSION) \
		SK_OCI_REPO=$(REGISTRY_URL) \
		SK_REPLICAS=$* \
		./tests/run.sh $(REGISTRY_URL)"

run-constant-vus-test-%:
	# SET `K6_VUS` ENV VAR TO OVERRIDE DEFAULT VUS
	bash -c "trap '(echo Logs from Constant VUs Test && kubectl logs job/constant-vus-$*-1)' EXIT; \
		TEST=constant-vus \
		SK_TEST_RUN_NAME=constant-vus-$* \
		SK_SPIN_APP_ROUTE="hello" \
		SK_SPIN_APP="hello-world-rust" \
		SK_OCI_TAG=$(SPIN_V_VERSION) \
		SK_OCI_REPO=$(REGISTRY_URL) \
		SK_REPLICAS=$* \
		./tests/run.sh $(REGISTRY_URL)"

run-tests: run-hello-world-test run-constant-vus-test-1 run-ramping-vus-test-1 run-ramping-vus-test-10 run-density-tests

cleanup: cleanup-apps cleanup-tests cleanup-configmaps

cleanup-apps:
	source utils.sh && delete_k8s_resources spinapps

cleanup-tests:
	source utils.sh && delete_k8s_resources testruns

cleanup-configmaps:
	kubectl delete configmap -l k6-test=true