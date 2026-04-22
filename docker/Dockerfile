FROM node:16
RUN apt-get update \
    && apt-get install -y --no-install-recommends sox \
    && rm -rf /var/lib/apt/lists/*
ADD ./coqui-stt /coqui-stt
WORKDIR /coqui-stt
RUN npm i
EXPOSE 3000
ENTRYPOINT ["node","index.js"]
