import { setLogger } from './logger.js';
import { createServerLogger } from './server.js';

setLogger(createServerLogger());
