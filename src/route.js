import _ from 'underscore'
import qs from 'qs'
import trigger from './trigger'
import urlComposer from 'url-composer'

const errorRouteNames = ['404']

const defaultDefinition = {
  name: null,
  path: null,
  action: null
}

const defaultNavigateOptions = {
  trigger: true,
  replace: false
}

function Route (definition) {
  // Store route definition
  this.definition = _.extend({}, defaultDefinition, definition)

  this.configure()
}

Route.prototype = {
  get (property) {
    return this.definition[property]
  },

  set (property, value) {
    this.definition[property] = value
  },

  parse (params, query) {
    return urlComposer.build({ path: this.get('path'), params, query })
  },

  configure () {
    // Extract relevant parameters from route definition
    let { name, path } = this.definition

    // Check if a path was defined and that the route is not a special error route
    if (path && !_.includes(errorRouteNames, name)) {
      // Remove heading slash from path
      if (_.isString(path)) {
        path = path.replace(/^(\/|#)/, '')
      }

      // Create regex from path
      this.pathRegExp = urlComposer.regex(path)

      // Reset path after modifying it
      this.set('path', path)
    }

    // Override the given action with the wrapped action
    this.set('action', this.getActionWrapper())
  },

  execute (...args) {
    return this.get('action')(...args)
  },

  getActionWrapper () {
    // Extract relevant parameters from route definition
    const { name, path, action, before, after } = this.definition

    // Wrap the route action
    return function actionWrapper (...args) {
      // Parse query string first
      const queryString = args.pop()
      let query = {}
      if (queryString) {
        query = qs.parse(queryString)
      }

      // Convert args to object
      let params = urlComposer.params(path, args)

      // Create promise for async handling of controller execution
      let prom
      // Trigger `before` events/middlewares
      if (before) {
        prom = trigger.exec({ name, events: before, params, query })
          .then(() => action({ params, query }))
      } else {
        // Just execute action if no `before` events are declared
        prom = Promise.resolve(action({ params, query }))
      }

      return prom
      // Wait for promise resolve
      .then(result => {
        // Trigger `after` events/middlewares
        if (after) {
          return trigger.exec({ name, events: after, params, query })
        }
        return true
      })
    }
  },

  getNavigateOptions (options) {
    return _.extend({}, defaultNavigateOptions, _.pick(options, ['trigger', 'replace']))
  }
}

export default Route
