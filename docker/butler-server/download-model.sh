#!/bin/sh

wget https://coqui.gateway.scarf.sh/english/coqui/v0.9.3/model.tflite -P ./models/
wget https://coqui.gateway.scarf.sh/english/coqui/v0.9.3/coqui-stt-0.9.3-models.scorer -P ./models/

# wget https://coqui.gateway.scarf.sh/english/coqui/v1.0.0-large-vocab/model.tflite -P ./models/
# wget https://coqui.gateway.scarf.sh/english/coqui/v1.0.0-large-vocab/large_vocabulary.scorer -P ./models/

# install sox
# sudo apt install sox
