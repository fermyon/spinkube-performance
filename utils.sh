#!/bin/bash

# Function: which_binary
# Description:
# Finds and prints the path of the specified binary if it exists in the system's PATH.
# If the binary is not found, it prints an error message.
# Parameters:
# $1 - The name of the binary to locate.
which_binary() {
  local binary_name="$1"
  local binary_path
  binary_path=$(command -v "$binary_name")
  if [[ -n "$binary_path" ]]; then
    echo "$binary_path"
  else
    echo "Could not find $binary_name" >&2
    exit 1
  fi
}

# Function: delete_k8s_resources
#
# Description:
# Deletes all resources of the provided type in the provided namespace
#
# Parameters:
# $1 - The name of the resource type.
# $2 - (Optional) The Kubernetes namespace
delete_k8s_resources() {
  resource_type="${1}"
  namespace="${2:-default}"

  which_binary kubectl

  # Loop through resources and delete
  for resource in $(kubectl -n $namespace get $resource_type -o name); do
      kubectl -n $namespace delete $resource
  done
}