#!/bin/bash

# TODO: change default to repo name
REGISTRY_URL=${1:-"ghcr.io/kate-goldenring/performance"}

# Navigate to the directory containing the script
cd "$(dirname "$0")" || exit

# List of build and pushed images
pushed_apps=()

spin_version=$(spin --version | awk '{print $2}')
# Loop through each directory in the current directory
for dir in */; do
    # Remove the trailing slash from the directory name
    dir_name="${dir%/}"
    pushd "$dir_name" || exit
    # If JS or TS app, install dependencies
    if [[ "$dir_name" == *js || "$dir_name" == *ts ]]; then
        npm install
    fi
    # If python app, install requirements
    if [[ "$dir_name" == *py ]]; then
        pip3 install -r requirements.txt
    fi
    image_address="$REGISTRY_URL"/"$dir_name":"$spin_version"
    spin build && spin registry push $image_address
    if [ $? -eq 0 ]; then
        pushed_apps+=("$image_address")
    fi
    popd || exit
done

echo ""
echo "Images pushed:"
for entry in "${pushed_apps[@]}"; do
    echo "$entry"
done