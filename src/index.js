/**
 * Utility class to execute async tasks sequentially.
 *
 * @author J. Scott Smith
 * @license BSD-2-Clause-FreeBSD
 * @module task-queue
 */

let defaultInterval = -1
let defaultMaxRetries = 3
let nextId = 1 // Next identifier for each TaskQueue instance

// Local logger that can be redirected
const logger = {}

function noLog () {}

export function configure (options) {
  if (typeof options !== 'object') return
  if (typeof options.interval === 'number') defaultInterval = options.interval
  if (typeof options.maxRetries === 'number') defaultMaxRetries = options.maxRetries
  if (typeof options.logger === 'object' || options.logger === false) {
    ['error', 'log', 'time', 'timeEnd', 'warn'].forEach(k => { logger[k] = (options.logger && options.logger[k]) || noLog })
  }
}

// Initial configuration
configure({
  logger: false
})

export class TaskQueue {
  constructor (options) {
    this.id = nextId++
    this.options = Object.assign({
      interval: defaultInterval,
      maxRetries: defaultMaxRetries
    }, options)
    this.interval = this.options.interval
    this.maxRetries = this.options.maxRetries
    this.items = []
  }

  /**
   * Cancel processing immediately and clean up.
   */
  destroy () {
    logger.log(`TaskQueue(${this.id})#destroy`)

    this.destroyed = true
    this.items = null
  }

  /**
   * Item at the head of the queue.
   */
  get head () { return this.items[0] }

  _done (resolve, context, ret, next = true) {
    if (context.isCompleted) return

    context.isCompleted = true
    logger.error(`TaskQueue(${this.id})#_done::context,ret,next`, context, ret, next)

    resolve(ret)
    if (next) this.next()
  }

  _error (reject, context, err, retry = true) {
    if (context.isCompleted) return

    if (retry && (context.numRetries++ < this.maxRetries)) {
      logger.error(`TaskQueue(${this.id})#_error::context,err,retry,numRetries,maxRetries`, context, err, retry, context.numRetries, this.maxRetries)

      this.next(false)
    } else {
      context.isCompleted = true
      logger.error(`TaskQueue(${this.id})#_error::context,err`, context, err)

      reject(err)
      this.next()
    }
  }

  * _workerGen () {
    this.isRunning = true

    logger.log(`TaskQueue(${this.id})#worker`)

    do {
      const item = this.head
      const exec = () => {
        logger.log(`TaskQueue(${this.id})#worker::item`, item)

        const ret = item.task(item)

        /*
          Tasks should return a promise, a value, or nothing (followed by calling done/error).
         */
        if (typeof ret === 'object' && typeof ret.then === 'function') {
          Promise.resolve(ret).then(item.done).catch(item.error)
        } else if (typeof ret !== 'undefined') {
          item.done(ret)
        }
      }

      // Don't block, strive for async
      yield this.interval < 0 ? setImmediate(exec) : setTimeout(exec, this.interval)
    } while (this.items.length > 0 && !this.destroyed)

    this.isRunning = false
  }

  next (deq = true) {
    if (!this.isRunning) return
    if (deq) this.items.shift()
    this._worker.next()
  }

  /**
   * Enqueue a task w/ data to process. Uses a generator to manage the tasks.
   */
  push (task, data) {
    logger.log(`TaskQueue(${this.id})#push::task,data`, task, data)

    return new Promise((resolve, reject) => {
      if (this.destroyed) return reject(new Error('Queue destroyed'))

      const context = {
        data: data,
        isCompleted: false,
        numRetries: 0,
        task: task
      }
      context.done = this._done.bind(this, resolve, context)
      context.error = this._error.bind(this, reject, context)

      // Enqueue context for task
      this.items.push(context)

      if (!this.isRunning) {
        this._worker = this._workerGen()
        this._worker.next()
      }
    })
  }
}
