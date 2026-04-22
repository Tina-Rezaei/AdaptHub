#  SoundSwallower speech recognition engine by @dhdaines 

## Running 
```
node index.js
```

## Recording an audio sample for testing (requires sox)
```
sox -c 1 -r 44100 -b 32 -e floating-point -d smart.raw trim 0 3
```
`trim 0 3` defines the duration of the recording (3 sec in this case).


