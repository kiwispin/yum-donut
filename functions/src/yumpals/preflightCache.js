// Cache only the browser's permission to send a request, not authentication,
// callable results, prices or balances. Every POST still runs the SDK handler.
// A proxy preserves all callable deployment descriptors, run/stream and hooks.
function withPreflightCache(callable) {
  return new Proxy(callable, {
    apply(handler, receiver, args) {
      if (args[0]?.method === 'OPTIONS') args[1].setHeader('Access-Control-Max-Age', '600');
      return Reflect.apply(handler, receiver, args);
    },
  });
}
module.exports = { withPreflightCache };
