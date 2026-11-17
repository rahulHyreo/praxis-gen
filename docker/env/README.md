# Environment files

Three layers, later overriding earlier.

| Layer | File        | Committed?          | Purpose                                                                                                         |
| ----- | ----------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1     | `base.env`  | yes                 | Non-secret defaults shared by every environment: ports, bucket names, the MinIO and Redis endpoints, pool size. |
| 2     | `<env>.env` | yes                 | Per-environment overrides. Only `local.env` exists.                                                             |
| 3     | `.env`      | **no — gitignored** | The only place a real secret may live. Optional; compose marks it `required: false`.                            |

`${APP_ENV}` selects which `<env>.env` to load, defaulting to `local`. The
compose files reference all three through `env_file:` lists, and
`docker/load-env.sh` applies the same order for a host shell.

Only `local.env` exists because this repository has only a local stack. The
_mechanism_ is v1's, kept intact, so adding a deployed environment later is a
data change — a new `<env>.env` — and not a re-architecture.

## Secrets

**No value that authenticates to anything outside your machine is committed
here.** Such values belong in `.env` alone, and this repository currently has
none of them: there is no email provider, no cloud storage account and no
authentication secret yet.

`local.env` does commit credentials — a Postgres user and password, MinIO root
credentials — and they are deliberately named `local-only-not-a-secret`. They
authenticate one container to another on a bridge network and nothing else. The
alternative is a stack that needs manual secret assembly before it will start,
which is a stack nobody runs; the first thing anyone would do is write the same
values into a file anyway. Treating them as sensitive would be theatre.

### What changed from v1, and why it matters

Praxis v1 commits real credentials to these files — a live SendGrid API key,
the Better Auth signing secret, database and MinIO passwords — and its own
README is explicit about the consequence: _"Treat repo read access as
production root access"_, with `git log -p docker/env/` as "the full disclosure
log".

That is a coherent position for a repository whose access list is tightly held,
but **v2 does not inherit it**, and this was the only moment where not
inheriting it was free. v2 has no external credential yet, so the model could be
dropped at zero cost. Later, with secrets already in the history, the only real
fix is a history rewrite.

So the rule for every change from here: a new secret goes in `.env`. The
`container-stack` capability carries a requirement and a scenario asserting no
committed file holds an API key, cloud account key or auth signing secret, and
the §7 auth port and §36 email change will each be held to it.

## Interpolation vs injection

Both paths feed from the same files:

```
docker/env/<layer>.env
        │
        ├── --env-file ……… compose's own ${VAR} interpolation, for
        │                   image:, ports: and composed values in the YAML
        │
        └── env_file: …… injected as container environment, per service
```

A value used in the YAML itself needs `--env-file`; a value the container reads
needs `env_file:`. Most are both, which is why the compose files list all three
layers and the documented commands pass `--env-file` for base and local.

## Ports

`base.env` sets a port block distinct from v1's, so both stacks can run on one
machine. That separation matters more than the naming: a name collision fails
loudly, but a port collision either refuses to start or silently attaches a tool
to the other stack's database. Override any of them in `.env` without touching a
compose file.
