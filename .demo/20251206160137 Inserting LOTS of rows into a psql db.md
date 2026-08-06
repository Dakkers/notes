---
tags: [Dev]
---

10m rows took about 7 minutes to execute (in Postico 2) for my specific use case...

```sql
INSERT INTO "my_table" ("id")
SELECT gen_random_uuid()
FROM generate_series(1,10e7) AS g(id);
```
