CREATE TRIGGER IF NOT EXISTS users_cpf_unique_on_insert
BEFORE INSERT ON users
WHEN EXISTS (
  SELECT 1 FROM users
  WHERE replace(replace(replace(cpf, '.', ''), '-', ''), ' ', '') = replace(replace(replace(NEW.cpf, '.', ''), '-', ''), ' ', '')
)
BEGIN
  SELECT RAISE(ABORT, 'cpf_in_use');
END;

CREATE TRIGGER IF NOT EXISTS users_cpf_unique_on_update
BEFORE UPDATE OF cpf ON users
WHEN EXISTS (
  SELECT 1 FROM users
  WHERE id <> NEW.id
    AND replace(replace(replace(cpf, '.', ''), '-', ''), ' ', '') = replace(replace(replace(NEW.cpf, '.', ''), '-', ''), ' ', '')
)
BEGIN
  SELECT RAISE(ABORT, 'cpf_in_use');
END;
