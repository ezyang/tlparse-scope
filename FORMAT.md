# tlparse JSONL specification

tlparse raw JSONL is a line-separated list of JSON objects for which payloads are omitted.

## String table

The very first entry of the JSONL file should be an object with `string_table`
entry that is an array.  This is a string table, in certain parts of the JSON
file, a string may be replaced with an integer index into this array.  At the
moment, only stack trace entries (e.g., `.dynamo_start.stack.[].filename` are
interned strings.

## Common fields

- timestamp - the time the event happened, e.g., "2025-05-29T09:30:40.009127Z"
- pathname, lineno - the source file and line number of the log line that
  emitted this event
- rank - the global rank of the node that emitted this node
- process - the process id that emitted this log
- `frame_id`, `frame_compile_id`, attempt - the "compile id", which uniquely
  identifies which run of the compiler emitted this log.  Typically, these are
  all rendered together as `${frame_id}/${frame_compile_id}_${attempt}`, or
  simply `${frame_id}/${frame_compile_id}` when attempt is 0.
- `has_payload` - the MD5 hash of the payload contents
- `payload_filename` - the file that contains the payload (if raw.jsonl is
  being served from a directory, navigating to the relative path specified
  here will give you the full ocntents of the payload

Conventionally, beyond these common fields, each distinct log entry will have
one further key (e.g., `describe_tensor`, `dynamo_start`, etc.) which contains
an object with the main payload for the log entry.

