const parsePort = (value: string | undefined): number => {
  if (!value) {
    return 3001;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("Invalid PORT. Expected an integer between 1 and 65535.");
  }

  return parsed;
};

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL environment variable.");
}

export const env = {
  PORT: parsePort(process.env.PORT),
  DATABASE_URL: databaseUrl,
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
