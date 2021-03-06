(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('underscore'), require('backbone'), require('qs'), require('url-composer')) :
  typeof define === 'function' && define.amd ? define(['underscore', 'backbone', 'qs', 'url-composer'], factory) :
  (global.Backbone = global.Backbone || {}, global.Backbone.Highway = factory(global._,global.Backbone,global.qs,global.urlComposer));
}(this, function (_,Backbone,qs,urlComposer) { 'use strict';

  _ = 'default' in _ ? _['default'] : _;
  Backbone = 'default' in Backbone ? Backbone['default'] : Backbone;
  qs = 'default' in qs ? qs['default'] : qs;
  urlComposer = 'default' in urlComposer ? urlComposer['default'] : urlComposer;

  function createStore () {
    var data = {}
    var keys = {}
    var lastRoute = null

    function get (key) {
      return keys[key]
    }

    function set (key, value) {
      keys[key] = value
    }

    function save (route) {
      // Retrieve route name
      var name = route.get('name')

      // If route is already declared throw an error
      if (_.has(data, name)) {
        throw new Error(("[ highway ] Route named " + name + " already declared"))
      }

      // Store new route
      data[name] = route
    }

    function find (search) {
      if (search.path) {
        var options = this.get('options')
        search.path = search.path.replace(options.root, '').replace(/^(\/|#)/, '')
      }

      return _.find(data, function (route) {
        return search.name === route.get('name') || (route.pathRegExp && route.pathRegExp.test(search.path))
      })
    }

    function getDefinitions () {
      var routes = {}
      var controllers = {}

      _.forEach(data, function (route, name) {
        routes[route.get('path')] = name
      })

      _.forEach(data, function (route, name) {
        controllers[name] = route.get('action')
      })

      return _.extend({ routes: routes }, controllers)
    }

    function getLastRoute () {
      return lastRoute
    }

    function setLastRoute (route) {
      lastRoute = route
    }

    return {
      get: get,
      set: set,
      save: save,
      find: find,
      getDefinitions: getDefinitions,
      getLastRoute: getLastRoute,
      setLastRoute: setLastRoute
    }
  }

  var store = createStore()

  var BackboneRouter = {
    create: function create (execute) {
      var Router = Backbone.Router.extend(
        Object.assign({}, store.getDefinitions(), { execute: execute })
      )
      return new Router()
    },

    start: function start (options) {
      if (!Backbone.History.started) {
        return Backbone.history.start(
          _.pick(options, ['pushState', 'hashChange', 'silent', 'root'])
        )
      }

      return null
    },

    restart: function restart () {
      Backbone.history.stop()
      Backbone.history.start()
    },

    back: function back () {
      Backbone.history.history.back()
    }
  }

  var options = {
    // #### Backbone History options
    // Docs: http://backbonejs.org/#History

    // Use html5 pushState
    pushState: true,

    // Root url for pushState
    root: '',

    // Set to false to force page reloads for old browsers
    hashChange: true,

    // Don't trigger the initial route
    silent: false,

    // #### Backbone.Highway specific options
    debug: false,

    // Event aggregator instance
    dispatcher: null
  }

  var trigger = {
    dispatch: function dispatch (ref) {
      var evt = ref.evt;
      var params = ref.params;
      var query = ref.query;

      var ref$1 = store.get('options');
      var dispatcher = ref$1.dispatcher;
      if (!dispatcher) {
        throw new Error(("[ highway ] Event '" + evt + "' could not be triggered, missing dispatcher"))
      }

      if (options.debug) {
        console.log(
  ("Trigger event " + evt + ",\nparams:\n  " + params + ",\nquery:\n  " + query))
      }

      return dispatcher.trigger(evt, { params: params, query: query })
    },

    exec: function exec (ref) {
      var this$1 = this;
      var name = ref.name;
      var events = ref.events;
      var params = ref.params;
      var query = ref.query;

      if (!_.isArray(events)) {
        events = [events]
      }

      return Promise.all(
        events.map(function (evt) {
          if (_.isFunction(evt)) {
            return evt({ params: params })
          }

          return this$1.dispatch({ evt: evt, params: params, query: query })
        })
      )
    }
  }

  var errorRouteNames = ['404']

  var defaultDefinition = {
    name: null,
    path: null,
    action: null
  }

  var defaultNavigateOptions = {
    trigger: true,
    replace: false
  }

  function Route (definition) {
    // Store route definition
    this.definition = _.extend({}, defaultDefinition, definition)

    this.configure()
  }

  Route.prototype = {
    get: function get (property) {
      return this.definition[property]
    },

    set: function set (property, value) {
      this.definition[property] = value
    },

    parse: function parse (params, query) {
      return urlComposer.build({ path: this.get('path'), params: params, query: query })
    },

    configure: function configure () {
      // Extract relevant parameters from route definition
      var ref = this.definition;
      var name = ref.name;
      var path = ref.path;

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

    execute: function execute () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      return this.get('action').apply(void 0, args)
    },

    getActionWrapper: function getActionWrapper () {
      // Extract relevant parameters from route definition
      var ref = this.definition;
      var name = ref.name;
      var path = ref.path;
      var action = ref.action;
      var before = ref.before;
      var after = ref.after;

      // Wrap the route action
      return function actionWrapper () {
        var args = [], len = arguments.length;
        while ( len-- ) args[ len ] = arguments[ len ];

        // Parse query string first
        var queryString = args.pop()
        var query = {}
        if (queryString) {
          query = qs.parse(queryString)
        }

        // Convert args to object
        var params = urlComposer.params(path, args)

        // Create promise for async handling of controller execution
        var prom
        // Trigger `before` events/middlewares
        if (before) {
          prom = trigger.exec({ name: name, events: before, params: params, query: query })
            .then(function () { return action({ params: params, query: query }); })
        } else {
          // Just execute action if no `before` events are declared
          prom = Promise.resolve(action({ params: params, query: query }))
        }

        return prom
        // Wait for promise resolve
        .then(function (result) {
          // Trigger `after` events/middlewares
          if (after) {
            return trigger.exec({ name: name, events: after, params: params, query: query })
          }
          return true
        })
      }
    },

    getNavigateOptions: function getNavigateOptions (options) {
      return _.extend({}, defaultNavigateOptions, _.pick(options, ['trigger', 'replace']))
    }
  }

  function RedirectError (ref) {
    var routeName = ref.routeName;
    var routePath = ref.routePath;
    var routeParams = ref.routeParams;
    var message = ref.message; if ( message === void 0 ) message = 'Redirect Error';

    this.message = message
    this.name = 'RedirectError'
    this.routeName = routeName
    this.routePath = routePath
    this.routeParams = routeParams
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this)
    } else {
      var temp = Error()
      this.stack = temp.stack
    }
  }
  RedirectError.prototype = Object.create(Error.prototype)

  var errors = {
    RedirectError: RedirectError
  }

  // Method to execute the 404 controller
  var error404 = function () {
    // Retrieve the 404 controller
    var error = store.find({ name: '404' })

    // Check if it was actually defined
    if (error) {
      // Execute a 404 controller
      return error.execute()
    }
  }

  // #### Highway public API definition
  var highway = {
    // **Initialize the Backbone.Highway router**
    // - *@param {Object} **options** - Object to override default router configuration*
    start: function start (options$$) {
      var this$1 = this;

      // Extend default options
      Object.assign(options, options$$)

      // Store options in global store
      store.set('options', options)

      // Instantiate Backbone.Router
      this.router = BackboneRouter.create(function (callback, args, name) {
        var promise
        if (callback) {
          promise = callback.apply(this$1, args)
        }
        if (promise && typeof promise.then === 'function') {
          promise.catch(function (e) {
            if (e.name === 'RedirectError') {
              this$1.go({ name: e.routeName, path: e.routePath, params: e.routeParams })
              return
            }
            return this$1.error(e)
          })
        }
      })

      // Start Backbone.history
      var existingRoute = BackboneRouter.start(options)

      // Check if the first load route exists, if not and
      // the router is not started silently try to execute 404 controller
      if (!existingRoute && !options.silent) error404()
    },

    // **Register a route to the Backbone.Highway router**
    // - *@param {Object} **definition** - The route definition*
    route: function route (definition) {
      // Create a new route using the given definition
      var route = new Route(definition)

      // Store the route in the global store
      store.save(route)

      // Check if Backbone.Router is already started
      if (this.router && route.get('path')) {
        // Dynamically declare route to Backbone.Router
        this.router.route(
          route.get('path'),
          route.get('name'),
          route.get('action')
        )
      }
    },

    // **Navigate to a declared route using its name or path**
    // - *@param {Mixed} **to** - Route name or Object describing where to navigate*
    go: function go (to) {
      if (!_.isString(to) && !_.isObject(to)) {
        throw new Error(("[ highway.go ] Navigate option needs to be a string or an object, got \"" + to + "\""))
      } else if (_.isObject(to) && !to.name && !to.path) {
        throw new Error('[ highway.go ] Navigate object is missing a "name" or "path" key')
      }

      // Transform route name to navigate object definition
      if (_.isString(to)) {
        to = { name: to }
      }

      // Find the route instance
      var route = store.find(to)

      // Check if the route exists
      if (!route) {
        error404()
        return false
      }

      // Parse the route path passing in arguments
      if (!to.path) {
        to.path = route.parse(to.args || to.params, to.query)
      }

      // Execute Backbone.Router navigate
      this.router.navigate(to.path, route.getNavigateOptions(to))

      // Retrieve last executed route
      var lastRoute = store.getLastRoute()

      // Force re-executing of the same route
      if (to.force && lastRoute && route.get('name') === lastRoute.get('name')) {
        this.reload()
      }

      // Store the last executed route
      store.setLastRoute(route)

      return true
    },

    back: function back () {
      // Execute Backbone.Router navigate
      BackboneRouter.back()
    },

    // Reload current route by restarting `Backbone.history`.
    reload: BackboneRouter.restart,

    // Alias for `reload` method.
    restart: BackboneRouter.restart,

    // Export the highway store
    store: store,

    // Called when a route or middleware returns an error
    error: function error (e) {
      if (options.debug) {
        console.error(
  ("Route Error -\n  " + e)
        )
      }
      return error404()
    },

    // Object containing various types of errors middleware/routes can return
    errors: errors
  }

  return highway;

}));