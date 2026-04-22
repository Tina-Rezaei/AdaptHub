# Install deps

To install all the dependencies `npm i` doesn't work. Don't ask me why. 
Instead, use a `yarn` command. It will compile all the packages needed.
At least it should do that.

First, install yarn

```npm install --global yarn```

Then, install deps for canvas package

```sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev```

Then install all deps

```yarn```