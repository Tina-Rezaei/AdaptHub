#!/bin/sh

# remove the service container if it exists already
docker rm coqui-stt-service

docker run -d -p 3000:3000 --name coqui-stt-service coqui-stt-service
