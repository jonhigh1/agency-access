# Reviewable hosting change — not applied

Service: AuthHub production API `agency-access` (`srv-d5r8nr4oud1c73eig0m0`).
Current compute: free, one instance, Virginia.
Proposed compute: `0.5c-512mb`, $7/month at the verified Render pricing table.
No workspace subscription change, instance count change, database change, or code deployment included.

After explicit spending/production-configuration approval, apply only this service plan:

```sh
render services update srv-d5r8nr4oud1c73eig0m0 --plan 0.5c-512mb --output json
```

Verify the returned plan and service readiness. Allow the resize restart to finish. Sign out/in through the existing owner Google session, wait for populated Dashboard, and record warm reload samples. Repeat login after at least 16 minutes without application traffic. Compare browser visible-ready latency separately from server processing duration and error rate. Do not claim a 10X improvement from warm-only samples.

Rollback changes only this service back to free compute; free idle sleep returns. Do not roll back code or change other services.

Evidence: live CLI confirms free compute; two owner login windows coincide with startup/migration markers before Dashboard GETs. Warm API processing was 3.3–97.2 ms. Source: https://render.com/docs/free and https://render.com/pricing.

Approval boundary: repository AGENTS.md requires approval before spending and production configuration changes. This proposal has not been applied.
