import { test, expect } from '@playwright/test';
import { startDockerCompose, stopDockerCompose } from './util';

test.beforeAll(async () => {
  await stopDockerCompose();
  await startDockerCompose();
  // Pause for 5 seconds to allow nginx test containers to start
  await new Promise(r => setTimeout(r, 5000));
});

test('Should register only services labelled with consul.register=true', async ({request}) => {
  const response = await request.get('http://consul:8500/v1/catalog/services', {});
  const json = await response.json()
  console.log(JSON.stringify(json, null, 2));
  expect(json).not.toHaveProperty('container2consul_nginx-ignore_1');
  expect(response.ok()).toBeTruthy();
  expect(json).not.toBeNull();
})

test('Should register the service with the name provided by consul.service', async ({request}) => {
  const response = await request.get('http://consul:8500/v1/catalog/services', {});
  const json = await response.json()
  expect(json).toHaveProperty('nginx-register');
})

test('Should register the service with the container name when consul.service is not provided', async ({request}) => {
  const response = await request.get('http://consul:8500/v1/catalog/services', {});
  const json = await response.json()
  expect(json).toHaveProperty('container2consul_nginx2_1');
})

test('Should deregister the services when containers are deleted', async ({request}) => {
  await stopDockerCompose();
  await new Promise(r => setTimeout(r, 3000));
  const response = await request.get('http://consul:8500/v1/catalog/services', {});
  const json = await response.json()
  console.log(JSON.stringify(json, null, 2));
  expect(json).not.toHaveProperty('nginx-register');
  expect(json).not.toHaveProperty('container2consul_nginx2_1');
})

test('Should reregister the services when containers are recreated', async ({request}) => {
  await startDockerCompose();
  await new Promise(r => setTimeout(r, 3000));
  const response = await request.get('http://consul:8500/v1/catalog/services', {});
  const json = await response.json()
  console.log(JSON.stringify(json, null, 2));
  expect(json).toHaveProperty('nginx-register');
  expect(json).toHaveProperty('container2consul_nginx2_1');
})


test.afterAll(async () => {
  await stopDockerCompose();
});