/**
 * Main tests
 */

describe('Module', function () {
  let tq

  // Simple logging to an array
  const logEntries = []
  const logger = {
    log: (...args) => {
      logEntries.push([...args].join(' '))
    }
  }

  it('should import', function () {
    tq = require('../../dist')

    expect(tq).to.have.property('TaskQueue')
  })

  it('should run tasks sequentially', function () {
    const results = {}

    const t1 = ({done}) => {
      setTimeout(() => {
        done(new Date())
      }, 400)
    }
    const t2 = () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(new Date())
        }, 200)
      })
    }
    const t3 = () => {
      return new Date()
    }

    tq.configure({
      interval: 0,
      logger: logger
    })

    const queue = new tq.TaskQueue()

    expect(queue).to.have.property('interval', 0)

    return Promise.all([
      queue.push(t1).then(date => {results.t1 = date}),
      queue.push(t2).then(date => {results.t2 = date}),
      queue.push(t3).then(date => {results.t3 = date})
    ]).then(() => {
      expect(results.t2).to.be.above(results.t1)
      expect(results.t3).to.be.above(results.t2)
    })
  })
})
