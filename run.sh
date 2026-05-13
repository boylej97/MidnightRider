#!/bin/sh
set -e
cd "$(dirname "$0")"
javac Server.java
exec java Server "$@"
