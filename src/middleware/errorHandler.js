function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  return res.status(err.status || 500).json({
    message: err.message || 'Internal server error.'
  });
}

module.exports = errorHandler;
