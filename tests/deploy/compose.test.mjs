import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

function envExample() {
  return Object.fromEntries(
    read('.env.example')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const eq = line.indexOf('=');
        return [line.slice(0, eq), line.slice(eq + 1)];
      }),
  );
}

// Resolved compose model, interpolated with the values of .env.example.
function composeConfig() {
  const json = execFileSync(
    'docker',
    ['compose', '-f', 'docker-compose.yml', '--env-file', '.env.example', 'config', '--format', 'json'],
    { cwd: root, encoding: 'utf8' },
  );
  return JSON.parse(json);
}

function stages(dockerfile) {
  return [...read(dockerfile).matchAll(/^FROM\s+(\S+)/gim)].map((m) => m[1]);
}

describe('docker-compose.yml', () => {
  it('defines db, api and web services', () => {
    assert.deepEqual(Object.keys(composeConfig().services).sort(), ['api', 'db', 'web']);
  });

  it('db uses PostgreSQL 18 with a named volume', () => {
    const config = composeConfig();
    const { db } = config.services;
    assert.equal(db.image, 'postgres:18-alpine');
    const data = db.volumes.find((v) => v.target === '/var/lib/postgresql');
    assert.ok(data, 'a volume is mounted at /var/lib/postgresql');
    assert.equal(data.type, 'volume');
    assert.ok(config.volumes?.[data.source], `volume ${data.source} is declared top-level`);
  });

  it('db has a healthcheck', () => {
    const { healthcheck } = composeConfig().services.db;
    assert.match(healthcheck.test.join(' '), /pg_isready/);
  });

  it('api waits for a healthy db', () => {
    assert.equal(composeConfig().services.api.depends_on.db.condition, 'service_healthy');
  });

  it('api gets its connection string from the environment', () => {
    const env = envExample();
    assert.equal(
      composeConfig().services.api.environment.ConnectionStrings__Nala,
      `Host=db;Port=5432;Database=${env.POSTGRES_DB};Username=${env.POSTGRES_USER};Password=${env.POSTGRES_PASSWORD}`,
    );
  });

  it('api gets the public URL and SMTP settings from the environment', () => {
    const env = envExample();
    const variables = ['NALA_PUBLIC_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_FROM', 'SMTP_SECURITY'];
    for (const variable of variables) {
      assert.ok(variable in env, `.env.example declares ${variable}`);
    }
    const { environment } = composeConfig().services.api;
    assert.deepEqual(
      {
        Nala__PublicUrl: environment.Nala__PublicUrl,
        Smtp__Host: environment.Smtp__Host,
        Smtp__Port: environment.Smtp__Port,
        Smtp__Username: environment.Smtp__Username,
        Smtp__Password: environment.Smtp__Password,
        Smtp__From: environment.Smtp__From,
        Smtp__Security: environment.Smtp__Security,
      },
      {
        Nala__PublicUrl: env.NALA_PUBLIC_URL,
        Smtp__Host: env.SMTP_HOST,
        Smtp__Port: env.SMTP_PORT,
        Smtp__Username: env.SMTP_USERNAME,
        Smtp__Password: env.SMTP_PASSWORD,
        Smtp__From: env.SMTP_FROM,
        Smtp__Security: env.SMTP_SECURITY,
      },
    );
  });

  it('email reset stays off by default: SMTP_HOST is empty in .env.example', () => {
    assert.equal(envExample().SMTP_HOST, '');
  });

  it('web is the only service publishing a port', () => {
    const { services } = composeConfig();
    assert.equal(services.db.ports, undefined);
    assert.equal(services.api.ports, undefined);
    assert.deepEqual(
      services.web.ports.map((p) => [p.target, p.published]),
      [[8080, envExample().NALA_HTTP_PORT]],
    );
  });

  it('web build can read the repository, to stamp the commit it was built from', () => {
    const { additional_contexts } = composeConfig().services.web.build;
    assert.equal(additional_contexts?.git, `${root.replace(/\/$/, '')}/.git`);
  });

  it('.env.example covers every variable compose uses', () => {
    const used = new Set([...read('docker-compose.yml').matchAll(/\$\{(\w+)/g)].map((m) => m[1]));
    const defined = envExample();
    assert.ok(used.size > 0);
    for (const name of used) assert.ok(name in defined, `${name} is missing from .env.example`);
  });
});

describe('Dockerfiles', () => {
  it('api builds with the .NET SDK and runs on the ASP.NET runtime', () => {
    const [build, runtime, ...rest] = stages('api/Dockerfile');
    assert.match(build, /^mcr\.microsoft\.com\/dotnet\/sdk:10\.0/);
    assert.match(runtime, /^mcr\.microsoft\.com\/dotnet\/aspnet:10\.0/);
    assert.deepEqual(rest, []);
  });

  it('web builds with Node and runs on nginx', () => {
    const [build, runtime, ...rest] = stages('web/Dockerfile');
    assert.match(build, /^node:24-alpine/);
    assert.match(runtime, /nginx/);
    assert.deepEqual(rest, []);
  });

  it('web is built with the short hash of the commit, read from the git context', () => {
    const dockerfile = read('web/Dockerfile');
    assert.match(dockerfile, /--mount=type=bind,from=git,/);
    assert.match(dockerfile, /rev-parse --short HEAD/);
    assert.match(dockerfile, /--define NALA_COMMIT=/);
  });
});
