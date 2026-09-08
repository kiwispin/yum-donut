// Preserve the SDK certificate instance/fields while preventing EmulatorLog's
// JSON.stringify({appName, opts}) from serializing credentials or future tokens.
function redactCredentialForLogs(credential) {
  Object.defineProperty(credential, 'toJSON', { enumerable: false, configurable: false,
    value: () => ({ type: 'ephemeral-local-certificate-redacted' }) });
  return credential;
}
module.exports = { redactCredentialForLogs };
