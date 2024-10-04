'use strict';

const mockRequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const SkipError = require('../../lib/errors/skipError');

describe('container-to-consul', () => {
  var ContainertoConsul;
  var containertoConsul;
  var stubs;

  beforeEach(() => {
    stubs = {
      log: {
        debug: sinon.spy(),
        info: sinon.spy(),
        error: sinon.spy()
      },
      consul: {
        catalog: {
          register: sinon.stub().resolves(),
          deregister: sinon.stub().resolves()
        },
        kv: {
          keys: sinon.stub().resolves(),
          get: sinon.stub().resolves(),
          set: sinon.stub().resolves(),
          delete: sinon.stub().resolves()
        }
      },
      docker: {
        _container: {
          inspect: sinon.stub().resolves()
        },
        client: {},
        containers: sinon.stub().resolves(),
        docker0: 'docker0',
        events: {
          on: sinon.stub()
        },
        start: sinon.stub().resolves()
      }
    };
    stubs.bunyan = {
      createLogger: sinon.stub().returns(stubs.log)
    };
    stubs.docker.client.getContainer = sinon.stub().returns(stubs.docker._container);
    stubs.Consul = sinon.stub().returns(stubs.consul);
    stubs.Docker = sinon.stub().returns(stubs.docker);

    mockRequire('bunyan', stubs.bunyan);
    mockRequire('../../lib/consul', stubs.Consul);
    mockRequire('../../lib/docker', stubs.Docker);
    ContainertoConsul = require('../../lib/container-to-consul');
    mockRequire.reRequire('../../lib/container-to-consul');

    containertoConsul = new ContainertoConsul({
      consul: {
        host: 'consul',
        port: 8500
      },
      docker: {
        socketPath: '/path'
      },
      logger: {
        name: 'test'
      }
    });
  });

  afterEach(() => {
    mockRequire.stopAll();
  });

  describe('#constructor', () => {
    it('should populate the object and attach Docker events', () => {
      should(stubs.Consul)
        .be.calledOnce()
        .be.calledWithMatch({
          host: 'consul',
          port: 8500
        });

      should(stubs.Docker)
        .calledOnce()
        .be.calledWith(containertoConsul);

      should(stubs.docker.events.on)
        .be.calledTwice()
        .be.calledWith('start')
        .be.calledWith('die');
    });

    describe('#events', () => {
      const container = {foo: 'bar'};
      let
        start,
        die;

      beforeEach(() => {
        containertoConsul.docker._container.inspect.resolves(container);
        sinon.stub(ContainertoConsul.prototype, 'registerContainer').resolves();
        sinon.stub(ContainertoConsul.prototype, 'containerServiceName').returns('service');
        sinon.stub(ContainertoConsul.prototype, 'deregisterService').resolves();
        containertoConsul._attachEvents();
        start = containertoConsul.docker.events.on.getCall(2).args[1];
        die = containertoConsul.docker.events.on.getCall(3).args[1];
      });

      it('#start should register the container', () => {
        return start({
          id: 'test'
        })
          .then(() => {
            should(containertoConsul.docker.client.getContainer)
              .be.calledOnce()
              .be.calledWith('test');

            should(containertoConsul.docker._container.inspect)
              .be.calledOnce();

            should(containertoConsul.registerContainer)
              .be.calledOnce()
              .be.calledWithExactly(container);

          });
      });

      it('#start should log the error if something goes wrong', () => {
        let error = new Error('test');

        containertoConsul.docker._container.inspect.rejects(error);

        return start({id: 'test'})
          .then(() => {
            should(1).be.false();
          })
          .catch(err => {
            should(containertoConsul.log.error)
              .be.calledOnce()
              .be.calledWithExactly(err);

            should(err).be.exactly(error);
          });
      });

      it('#die should deregisterService the container', () => {
        return die({id: 'test'})
          .then(() => {
            should(containertoConsul.docker.client.getContainer)
              .be.calledOnce()
              .be.calledWith('test');

            should(containertoConsul.docker._container.inspect)
              .be.calledOnce();

            should(containertoConsul.containerServiceName)
              .be.calledOnce()
              .be.calledWithExactly(container);

            should(containertoConsul.deregisterService)
              .be.calledOnce()
              .be.calledWith('service');
          });
      });

      it('#die should log the error if something goes wrong', () => {
        let error = new Error('test');

        containertoConsul.docker._container.inspect.rejects(error);

        return die({id: 'test'})
          .then(() => {
            should(1).be.false();
          })
          .catch(err => {
            should(containertoConsul.log.error)
              .be.calledOnce()
              .be.calledWithExactly(err);

            should(err).be.exactly(error);
          });
      });
    });
  });

  describe('#start', () => {
    var container;

    beforeEach(() => {
      let error = new Error('test');
      error.statusCode = 404;

      container = {
        inspect: sinon.stub().rejects(error)
      };

      containertoConsul.registerContainers = sinon.stub().resolves();
      containertoConsul.registerContainer = sinon.stub().resolves();
      containertoConsul.deregisterService = sinon.stub().resolves();
      containertoConsul.consul.kv.keys.resolves([
        'test',
        'foo'
      ]);
      containertoConsul.docker.client.getContainer.returns(container);
    });

    it('should deregisterService non-running containers and register running ones', () => {
      return containertoConsul.start()
        .then(() => {
          should(containertoConsul.consul.kv.keys)
            .be.calledOnce()
            .be.calledWith('docker/service-ids/');

          should(containertoConsul.consul.kv.get)
            .be.calledTwice()
            .be.calledWith('test')
            .be.calledWith('foo');

          should(containertoConsul.docker.client.getContainer)
            .be.calledTwice();

          should(containertoConsul.deregisterService)
            .be.calledTwice()
            .be.calledWith('test')
            .be.calledWith('foo');

          should(containertoConsul.docker.containers)
            .be.calledOnce();

          should(containertoConsul.registerContainers)
            .be.calledOnce();
        });
    });

    it('should not fail if no docker/service-ids key is stored in consul', () => {
      var error = new Error('test');
      error.statusCode = 404;

      containertoConsul.consul.kv.keys.rejects(error);

      return containertoConsul.start()
        .then(() => {
          should(containertoConsul.registerContainers)
            .be.calledOnce();
        });
    });

    it('should reject the promise if consul kv throws an unexpected error', () => {
      var error = new Error('unexpected');
      containertoConsul.consul.kv.keys.rejects(error);

      return containertoConsul.start()
        .then(() => {
          throw new Error('this should not happen');
        })
        .catch(e => {
          should(e).be.exactly(error);

          should(containertoConsul.log.error)
            .be.calledOnce()
            .be.calledWith(e);
        });
    });

    it('should deregisterService non-running containers', () => {
      container.inspect
        .onFirstCall().resolves({
          State: {
            Status: 'down'
          }
        });

      return containertoConsul.start()
        .then(() => {
          should(containertoConsul.deregisterService)
            .be.calledTwice();
        });
    });

    it('should reject the promise if we cannot inspect the container', () => {
      var error = new Error('test');

      container.inspect
        .onSecondCall().rejects(error);

      return containertoConsul.start()
        .then(() => {
          throw new Error('this should not happen');
        })
        .catch(e => {
          should(containertoConsul.log.error)
            .be.calledWith(e);

          should(e).be.exactly(error);
        });
    });
  });

  describe('#registerConstainers', () => {
    it('should call registerContainer for all containers', () => {
      containertoConsul.registerContainer = sinon.stub().resolves();

      return containertoConsul.registerContainers([
        'test',
        'foo'
      ])
        .then(() => {
          should(containertoConsul.registerContainer)
            .be.calledTwice()
            .be.calledWith('test')
            .be.calledWith('foo');
        });
    });
  });

  describe('#registerContainer', () => {
    beforeEach(() => {
      containertoConsul.container2Service = sinon.stub().returns({foo: 'bar'});
      containertoConsul.containerServiceName = sinon.stub().returns('foo');
    });

    it('should reject if we cannot parse the docker inspect result', () => {
      var error = new Error('test');

      containertoConsul.container2Service.throws(error);

      return should(containertoConsul.registerContainer('test'))
        .be.rejectedWith(error);
    });

    it('should resolve and do nothing is the container needs to be skipped', () => {
      var error = new SkipError('test');

      containertoConsul.container2Service.throws(error);

      return containertoConsul.registerContainer('test')
        .then(() => {
          should(containertoConsul.log.info)
            .be.calledOnce()
            .be.calledWith('test');

          should(containertoConsul.consul.catalog.register)
            .have.callCount(0);
        });
    });

    it('should register the service in consul', () => {
      return containertoConsul.registerContainer({Id: 'test'})
        .then(() => {
          should(containertoConsul.log.info)
            .be.calledOnce()
            .be.calledWith('registering container');

          should(containertoConsul.consul.catalog.register)
            .be.calledOnce()
            .be.calledWithMatch({foo: 'bar'});

          should(containertoConsul.consul.kv.set)
            .be.calledOnce()
            .be.calledWith('docker/service-ids/foo', 'test');
        });
    });

    it('should reject the promise if consul fails to register the service', () => {
      let error = new Error('test');

      containertoConsul.consul.catalog.register.rejects(error);

      return should(containertoConsul.registerContainer({}))
        .be.rejectedWith(error);
    });
  });

  describe('#deregisterService', () => {
    it('should log and reject errors', () => {
      let error = new Error('test');

      containertoConsul.consul.catalog.deregister.rejects(error);

      return containertoConsul.deregisterService()
        .then(() => {
          throw new Error('this should not happen');
        })
        .catch(e => {
          should(e).be.exactly(error);

          should(containertoConsul.log.error)
            .be.calledOnce()
            .be.calledWith(error);
        });
    });

    it('should deregisterService the node and associated key', () => {
      return containertoConsul.deregisterService('test')
        .then(() => {
          should(containertoConsul.consul.catalog.deregister)
            .be.calledOnce()
            .be.calledWithMatch({ Node: 'test' });

          should(containertoConsul.consul.kv.delete)
            .be.calledTwice()
            .be.calledWith('docker/service-ids/test')
            .be.calledWith('services/test');
        });
    });
  });

  describe('#container2Service', () => {
    beforeEach(() => {
      containertoConsul.containerServiceName = sinon.stub().returns('foo');
    });

    it('should parse the inspect result', () => {
      let result = containertoConsul.container2Service({
        Config: {
          Labels: {
            'consul.ip': 'consul ip',
            'consul.port': '8888 consul port',
            'consul.service': 'consul service',
            'consul.tags': 'consul,tags',
            'consul.register': 'true'
          }
        },
        NetworkSettings: {
          Networks: {
            test: {
              IPAddress: 'ip'
            }
          }
        }
      });
      should(result.Node).be.exactly('foo');
      should(result.Address).be.exactly('consul ip');
      should(result.Service.Service).be.exactly('consul service');
      should(result.Service.Port).be.exactly(8888);
      should(result.Service.Tags).match(['consul', 'tags']);
    });

    it('should not set the port if it does not manage to cast it to an int', () => {
      let result = containertoConsul.container2Service({
        Labels: {
          'consul.port': 'not a number',
          'consul.register': 'true'
        },
        NetworkSettings: {
          Networks: {
            IPAddress: 'ip'
          }
        }
      });

      should(result.Service.Port).be.undefined();
    });

    it('should use docker0 ip address if `host` is specified for ip', () => {
      let result = containertoConsul.container2Service({
        Labels: {
          'consul.ip': 'host',
          'consul.register': 'true'
        },
        NetworkSettings: {
          Networks: {
            IPAddress: 'ip'
          }
        }
      });

      should(result.Address).be.exactly(containertoConsul.docker.docker0);
    });
  });

  describe('#containerServiceName', () => {
    it('should get the container name from inecpted result', () => {
      should(containertoConsul.containerServiceName({
        Name: 'container',
        Labels: {
          'consul.name': 'name',
          'consul.register': 'true'
        }
      })).be.exactly('name');

      should(containertoConsul.containerServiceName({
        Names: ['name', 'foo']
      })).be.exactly('name');

      should(containertoConsul.containerServiceName({
        Name: 'test',
        Config: {
          Labels: {
            'consul.name': 'foobar',
            'consul.register': 'true'
          }
        }
      })).be.exactly('foobar');
    });
  });


});