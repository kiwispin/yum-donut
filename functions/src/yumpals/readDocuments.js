// One transaction RPC for independent documents. Firestore queues other reads
// behind the first RPC, so Promise.all(get(...)) alone leaves an extra wait.
function readDocuments(transaction, refs) {
  if (!refs.length) return Promise.resolve([]);
  return typeof transaction.getAll === 'function'
    ? transaction.getAll(...refs) : Promise.all(refs.map(ref => transaction.get(ref)));
}
module.exports = { readDocuments };
