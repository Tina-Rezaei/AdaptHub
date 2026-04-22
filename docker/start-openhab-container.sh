#!/bin/sh

# remove openhab container if it was stopped previously
docker rm openhab

docker run \
        --name openhab \
        --net=host \
        -v /etc/localtime:/etc/localtime:ro \
        -v /etc/timezone:/etc/timezone:ro \
        -v /home/zavalyshyn/Documents/phd/smartcare/dev/hubos-dev/docker/openhab/conf:/openhab/conf \
        -v /home/zavalyshyn/Documents/phd/smartcare/dev/hubos-dev/docker/openhab/userdata:/openhab/userdata \
        -v /home/zavalyshyn/Documents/phd/smartcare/dev/hubos-dev/docker/openhab/addons:/openhab/addons \
        -d \
        -e USER_ID=998 \
        -e GROUP_ID=997 \
        -e CRYPTO_POLICY=unlimited \
        --restart=always \
        openhab/openhab:latest
