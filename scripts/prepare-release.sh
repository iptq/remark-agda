#!/usr/bin/env bash

mkdir -p dist/
bun build --target node src/index.ts > dist/index.js
bunx tsc