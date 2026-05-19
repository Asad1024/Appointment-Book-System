# Default Business Policies (configurable per service/location)

| Policy | Default | Notes |
|--------|---------|-------|
| Cancellation cutoff | 24 hours before start | Customer cannot cancel inside window |
| Reschedule cutoff | 24 hours before start | Same as cancellation unless overridden |
| Max reschedules | 3 per appointment | Enforced in API |
| Lead time | 2 hours | Cannot book slots starting sooner |
| Booking window | 60 days ahead | Max future booking date |
| Buffer before | 0 min | Prep time |
| Buffer after | 10 min | Cleanup between appointments |
| No-show | Manual flag by admin | Phase 2: automated fees |
| Approval required | false (MVP) | Set `requiresApproval` on service for Phase 2 |

Policies are stored on `Service` and `Location` models; API validates on book/cancel/reschedule.
