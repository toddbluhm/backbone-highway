const options = {
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

export default options
