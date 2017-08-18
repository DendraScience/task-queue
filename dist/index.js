'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TaskQueue = undefined;

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _setImmediate2 = require('babel-runtime/core-js/set-immediate');

var _setImmediate3 = _interopRequireDefault(_setImmediate2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

exports.configure = configure;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Utility class to execute async tasks sequentially.
 *
 * @author J. Scott Smith
 * @license BSD-2-Clause-FreeBSD
 * @module task-queue
 */

var defaultInterval = -1;
var defaultMaxRetries = 3;
var nextId = 1; // Next identifier for each TaskQueue instance

// Local logger that can be redirected
var logger = {};

function noLog() {}

function configure(options) {
  if ((typeof options === 'undefined' ? 'undefined' : (0, _typeof3.default)(options)) !== 'object') return;
  if (typeof options.interval === 'number') defaultInterval = options.interval;
  if (typeof options.maxRetries === 'number') defaultMaxRetries = options.maxRetries;
  if ((0, _typeof3.default)(options.logger) === 'object' || options.logger === false) {
    ['error', 'log', 'time', 'timeEnd', 'warn'].forEach(function (k) {
      logger[k] = options.logger && options.logger[k] || noLog;
    });
  }
}

// Initial configuration
configure({
  logger: false
});

var TaskQueue = exports.TaskQueue = function () {
  function TaskQueue(options) {
    (0, _classCallCheck3.default)(this, TaskQueue);

    this.id = nextId++;
    this.options = (0, _assign2.default)({
      interval: defaultInterval,
      maxRetries: defaultMaxRetries
    }, options);
    this.interval = this.options.interval;
    this.maxRetries = this.options.maxRetries;
    this.items = [];
  }

  /**
   * Cancel processing immediately and clean up.
   */


  (0, _createClass3.default)(TaskQueue, [{
    key: 'destroy',
    value: function destroy() {
      logger.log('TaskQueue(' + this.id + ')#destroy');

      this.destroyed = true;
      this.items = null;
    }

    /**
     * Item at the head of the queue.
     */

  }, {
    key: '_done',
    value: function _done(resolve, context, ret) {
      var next = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

      if (context.isCompleted) return;

      context.isCompleted = true;
      logger.error('TaskQueue(' + this.id + ')#_done::context,ret,next', context, ret, next);

      resolve(ret);
      if (next) this.next();
    }
  }, {
    key: '_error',
    value: function _error(reject, context, err) {
      var retry = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

      if (context.isCompleted) return;

      if (retry && context.numRetries++ < this.maxRetries) {
        logger.error('TaskQueue(' + this.id + ')#_error::context,err,retry,numRetries,maxRetries', context, err, retry, context.numRetries, this.maxRetries);

        this.next(false);
      } else {
        context.isCompleted = true;
        logger.error('TaskQueue(' + this.id + ')#_error::context,err', context, err);

        reject(err);
        this.next();
      }
    }
  }, {
    key: '_workerGen',
    value: /*#__PURE__*/_regenerator2.default.mark(function _workerGen() {
      var _this = this;

      var _loop;

      return _regenerator2.default.wrap(function _workerGen$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              this.isRunning = true;

              logger.log('TaskQueue(' + this.id + ')#worker');

              _loop = /*#__PURE__*/_regenerator2.default.mark(function _loop() {
                var item, exec;
                return _regenerator2.default.wrap(function _loop$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        item = _this.head;

                        exec = function exec() {
                          logger.log('TaskQueue(' + _this.id + ')#worker::item', item);

                          var ret = item.task(item);

                          /*
                            Tasks should return a promise, a value, or nothing (followed by calling done/error).
                           */
                          if ((typeof ret === 'undefined' ? 'undefined' : (0, _typeof3.default)(ret)) === 'object' && typeof ret.then === 'function') {
                            _promise2.default.resolve(ret).then(item.done).catch(item.error);
                          } else if (typeof ret !== 'undefined') {
                            item.done(ret);
                          }
                        };

                        // Don't block, strive for async


                        _context.next = 4;
                        return _this.interval < 0 ? (0, _setImmediate3.default)(exec) : setTimeout(exec, _this.interval);

                      case 4:
                      case 'end':
                        return _context.stop();
                    }
                  }
                }, _loop, _this);
              });

            case 3:
              return _context2.delegateYield(_loop(), 't0', 4);

            case 4:
              if (this.items.length > 0 && !this.destroyed) {
                _context2.next = 3;
                break;
              }

            case 5:

              this.isRunning = false;

            case 6:
            case 'end':
              return _context2.stop();
          }
        }
      }, _workerGen, this);
    })
  }, {
    key: 'next',
    value: function next() {
      var deq = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

      if (!this.isRunning) return;
      if (deq) this.items.shift();
      this._worker.next();
    }

    /**
     * Enqueue a task w/ data to process. Uses a generator to manage the tasks.
     */

  }, {
    key: 'push',
    value: function push(task, data) {
      var _this2 = this;

      logger.log('TaskQueue(' + this.id + ')#push::task,data', task, data);

      return new _promise2.default(function (resolve, reject) {
        if (_this2.destroyed) return reject(new Error('Queue destroyed'));

        var context = {
          data: data,
          isCompleted: false,
          numRetries: 0,
          task: task
        };
        context.done = _this2._done.bind(_this2, resolve, context);
        context.error = _this2._error.bind(_this2, reject, context);

        // Enqueue context for task
        _this2.items.push(context);

        if (!_this2.isRunning) {
          _this2._worker = _this2._workerGen();
          _this2._worker.next();
        }
      });
    }
  }, {
    key: 'head',
    get: function get() {
      return this.items[0];
    }
  }]);
  return TaskQueue;
}();