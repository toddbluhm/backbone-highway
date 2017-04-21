function RedirectError ({ routeName, routePath, routeParams, message = 'Redirect Error' }) {
  this.message = message
  this.name = 'RedirectError'
  this.routeName = routeName
  this.routePath = routePath
  this.routeParams = routeParams
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this)
  } else {
    const temp = Error()
    this.stack = temp.stack
  }
}
RedirectError.prototype = Object.create(Error.prototype)

export default {
  RedirectError
}
