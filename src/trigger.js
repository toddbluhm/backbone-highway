import _ from 'underscore'
import store from './store'
import GlobalOptions from './options'

export default {
  dispatch ({ evt, params, query }) {
    const { dispatcher } = store.get('options')
    if (!dispatcher) {
      throw new Error(`[ highway ] Event '${evt}' could not be triggered, missing dispatcher`)
    }

    if (GlobalOptions.debug) {
      console.log(
`Trigger event ${evt},
params:
  ${params},
query:
  ${query}`)
    }

    return dispatcher.trigger(evt, { params, query })
  },

  exec ({ name, events, params, query }) {
    if (!_.isArray(events)) {
      events = [events]
    }

    return Promise.all(
      events.map(evt => {
        if (_.isFunction(evt)) {
          return evt({ params })
        }

        return this.dispatch({ evt, params, query })
      })
    )
  }
}
