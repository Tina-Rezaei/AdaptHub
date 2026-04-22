#!/usr/bin/env node
/**
 * Generate face embeddings for a new image.
 * Usage: node generate-embedding.js <image-path> <person-name>
 */

const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const Human = require('@vladmandic/human');

const config = {
    modelBasePath: 'file://' + path.resolve(__dirname, 'node_modules/@vladmandic/human/models'),
    cacheModels: false,
    debug: false,
    backend: 'tensorflow',
    face: {
        description: { enabled: true },
        emotion: { enabled: false },
        iris: { enabled: false }
    },
    body: { enabled: false },
    hand: { enabled: false },
    gesture: { enabled: false },
};

async function generateEmbedding(imagePath, personName) {
    console.log('Initializing TensorFlow...');
    await tf.ready();
    
    console.log('Loading Human.js models...');
    const human = new Human.Human(config);
    await human.load();
    
    console.log(`Processing image: ${imagePath}`);
    const imageBuffer = fs.readFileSync(imagePath);
    const tensor = human.tf.node.decodeImage(imageBuffer, 3);
    
    console.log('Detecting faces...');
    const result = await human.detect(tensor, config);
    human.tf.dispose(tensor);
    
    if (!result.face || result.face.length === 0) {
        console.error('No faces detected in the image!');
        process.exit(1);
    }
    
    console.log(`Detected ${result.face.length} face(s)`);
    
    // Use the first face's embedding
    const embedding = result.face[0].embedding;
    
    if (!embedding || embedding.length === 0) {
        console.error('Failed to generate embedding!');
        process.exit(1);
    }
    
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Create the known-faces.json structure
    const knownFaces = [{
        name: personName,
        embedding: Array.from(embedding)
    }];
    
    // Write to known-faces.json
    const outputPath = path.join(__dirname, 'known-faces.json');
    fs.writeFileSync(outputPath, JSON.stringify(knownFaces));
    console.log(`\nSaved embeddings to: ${outputPath}`);
    
    // Also copy to resources folder if it exists
    const resourcesPath = path.join(__dirname, 'resources', 'known-faces.json');
    if (fs.existsSync(path.dirname(resourcesPath))) {
        fs.writeFileSync(resourcesPath, JSON.stringify(knownFaces));
        console.log(`Saved embeddings to: ${resourcesPath}`);
    }
    
    console.log('\nDone!');
    process.exit(0);
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node generate-embedding.js <image-path> <person-name>');
    console.log('Example: node generate-embedding.js ../../system/resources/camera-frame2.jpg "Sample Person"');
    process.exit(1);
}

generateEmbedding(args[0], args[1]);
