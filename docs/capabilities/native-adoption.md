# Install, adopt, and bind

English | [简体中文](native-adoption.zh-CN.md)

Pactile distinguishes installing a Pactile projection from adopting a native
resource. The distinction protects user files and keeps two hosts from creating
duplicate state.

| Observed state                               | Operation      | Ownership result                                                | Detach result                                           |
| -------------------------------------------- | -------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| External/native dependency absent            | `install-hint` | User or host installs it; later detection is borrowed.          | Pactile never removes it.                               |
| Pactile projection absent                    | `install`      | Pactile records a managed resource and the requesting claimant. | Delete only with final claimant and safe managed bytes. |
| Compatible pre-existing native asset         | `adopt`        | Record owner, preimage, and borrowed control.                   | Preserve the asset.                                     |
| Installed or adopted asset ready for a Tile  | `bind`         | Add a host/capability binding and claimant.                     | Remove only that binding.                               |
| Same identity, different semantics           | `conflict`     | Leave bytes untouched and require a choice.                     | Keep review evidence.                                   |
| Malformed, locked, untrusted, or unavailable | `degraded`     | Keep a retryable plan and limit impact to one host.             | Retry after the user resolves the cause.                |

The resource identity is `kind + stable logical id` within a workspace. Ownership
records claimant, control (`managed` or `borrowed`), preimage, current
fingerprint, and deletion policy. A binding is not ownership, and host identity
is not authorization.

## Safe sequence

```text
detect -> preview plan -> explicit install/adopt/bind -> reconcile -> receipt
```

Use `pactile update --dry-run` to inspect a projection plan. On conflict or
modified bytes, stop and resolve ownership explicitly. Never solve a conflict
by deleting the file or copying canonical content into a native config.
