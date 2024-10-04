const Dockerode = require('dockerode');
const DockerodeCompose = require('dockerode-compose');
const fs = require('fs');
const path = require('path')

const docker = new Dockerode();
const compose = new DockerodeCompose(docker, path.resolve(__dirname, './docker/test-compose.yaml'), 'container2consul');
export async function startDockerCompose() {
  await compose.pull();
  await compose.up();
}

export async function stopDockerCompose() {
  await compose.down();
}