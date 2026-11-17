// `express-async-errors` ships no type declarations. It is a side-effect-only
// import that monkey-patches Express 4's Router so a rejected promise from an
// `async` route handler is forwarded to the error-handling middleware instead
// of becoming an unhandled rejection..
declare module "express-async-errors"
