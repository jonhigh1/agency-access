# Pagination

List endpoints (`GET /clients`, `GET /requests`,
`GET /webhook-endpoints/{id}/deliveries`) use opaque keyset cursors,
stable under concurrent inserts:

```http
GET /api/v1/clients?limit=50&cursor=eyJj...
```

- `limit` defaults to 50, max 100.
- Responses carry `meta.pagination: { nextCursor, hasMore }`. Pass
  `nextCursor` as `cursor` for the next page; `hasMore: false` ends the
  walk.
- Cursors are opaque: treat them as blobs, never construct them.
  A malformed cursor fails with `VALIDATION_ERROR`.
- Filters (`email`, `status`, external-ID request listing) apply inside
  the same cursor walk, so a page reflects the filter exactly.
- Unknown query parameters fail with `VALIDATION_ERROR` naming the
  parameter.
