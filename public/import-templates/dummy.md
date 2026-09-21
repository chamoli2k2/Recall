Q: What is optimistic concurrency?
A: Each write sends the version it last read. If that version no longer matches, the server returns 409 and does not overwrite. #concurrency #databases

Q: What does HTTP 201 mean?
A: Created. A new resource exists, often with a Location header.
tags: http, rest

- heart :: The heart pumps blood. #biology
- idempotent :: Repeating a request has the same intended effect as executing it once. #apis
