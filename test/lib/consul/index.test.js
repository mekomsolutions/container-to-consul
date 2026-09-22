'use strict';

const mockRequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const sandbox = sinon.sandbox.create();
const Catalog = require('../../../lib/consul/catalog');
const Kv = require('../../../lib/consul/kv');

describe('consul', () => {
  var
    Consul,
    consul,
    stubs = {
      axios: sandbox.stub().resolves({ data: true })
    };

  before(() => {
    mockRequire('axios', stubs.axios);
    Consul = require('../../../lib/consul');
  });

  beforeEach(() => {
    consul = new Consul({
      host: 'host',
      port: '80'
    });
  });

  afterEach(() => {
    // sandbox.restore does actually not restore stubs
    sandbox.fakes.forEach(fake => fake.reset());
  });

  describe('#_send', () => {
    it ('should send what needs to', () => {
      consul.acl = 'acl';

      return consul._send('method', '/uri?foo=bar', 'body')
        .then(data => {
          should(data).be.exactly(true);
          should(stubs.axios)
            .be.calledOnce()
            .be.calledWithMatch({
              baseURL: 'http://host:80',
              method: 'method',
              url: '/uri?foo=bar&token=acl',
              data: 'body'
            });

        });
    });

    it('should return axios response.data', () => {
      const keys = ['docker/service-ids/nginx'];
      stubs.axios.resolves({ data: keys, status: 200 });

      return consul._send('GET', '/v1/kv/docker/service-ids/?keys')
        .then(data => {
          should(data).eql(keys);
        });
    });

    it('should parse JSON bodies and keep raw Consul KV values', () => {
      return consul._send('GET', '/uri')
        .then(() => {
          const transform = stubs.axios.firstCall.args[0].transformResponse[0];

          should(transform('["docker/service-ids/nginx"]'))
            .eql(['docker/service-ids/nginx']);
          should(transform('a66c884d114e25a47d6f2852d46c85a4b4718a97d6c243c153826f5de6498232'))
            .eql('a66c884d114e25a47d6f2852d46c85a4b4718a97d6c243c153826f5de6498232');
          should(transform('')).eql({});
        });
    });
  });

  describe('#_get', () => {
    it('should call _send with GET', () => {
      consul.acl = 'acl';

      return consul._get('/uri')
        .then(() => {
          should(stubs.axios)
            .be.calledOnce()
            .be.calledWithMatch({
              method: 'GET',
              url: '/uri?token=acl'
            });
        });
    });
  });

  describe('#_put', () => {
    beforeEach(() => {
      consul._send = sinon.spy();
    });

    it('should call _send with PUT', () => {
      consul._put('/uri', 'data');

      should(consul._send)
        .be.calledOnce()
        .be.calledWith('PUT', '/uri', 'data');
    });

    it('should set the dc if set globally', () => {
      consul.dc = 'dc';

      consul._put('/uri', {foo: 'bar'});

      should(consul._send)
        .be.calledWithMatch('PUT', '/uri', {
          foo: 'bar',
          Datacenter: 'dc'
        });
    });
  });

  describe('#_delete', () => {
    beforeEach(() => {
      consul._send = sinon.spy();
    });

    it('should call _send with DELETE', () => {
      consul._delete('/uri');

      should(consul._send)
        .be.calledOnce()
        .be.alwaysCalledWith('DELETE', '/uri');
    });
  });

  it('These are just for coverage', () => {
    should(consul.catalog)
      .be.an.instanceOf(Catalog);
    should(consul.kv)
      .be.an.instanceOf(Kv);
  });

});