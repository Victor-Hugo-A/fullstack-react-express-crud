function validate(validator) {
  return (req, res, next) => {
    try {
      validator(req);
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { validate };
