'use strict';

const ContainertoConsul = require('./container-to-consul');
const config = require('./config');
const conTainer2Sul = new ContainertoConsul(config);

conTainer2Sul.start();

