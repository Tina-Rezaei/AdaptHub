#!/bin/sh

curl -X POST localhost:3000 --data-binary "@./coqui-stt/smart.raw"
