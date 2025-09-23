const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message } = err;

  logger.error('Error occurred:', {
    error: message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: statusCode === 500 ? 'Internal Server Error' : message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound
};