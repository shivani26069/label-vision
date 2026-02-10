#!/bin/bash
# Simple test script to upload an image to /scan
# Usage: ./test_scan.sh /path/to/label.jpg

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_image>"
  exit 1
fi

curl -X POST "http://localhost:8000/scan" \
  -F "file=@$1" \
  | jq .
