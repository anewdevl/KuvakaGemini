const errorHandler = (err, req, res, next) => {
  console.error("Error:", err)

  // Default error
  let statusCode = 500
  let message = "Internal server error"

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400
    message = err.message
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401
    message = "Unauthorized"
  } else if (err.code === "23505") {
    // PostgreSQL unique constraint violation
    statusCode = 409
    message = "Resource already exists"
  } else if (err.code === "23503") {
    // PostgreSQL foreign key violation
    statusCode = 400
    message = "Invalid reference"
  } else if (err.message) {
    message = err.message
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  })
}

module.exports = {
  errorHandler,
}
