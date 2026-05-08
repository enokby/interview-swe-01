#!/bin/sh
# wait-for.sh

set -e

host="$1"
shift
cmd="$@"

until nc -z "$host" 5432; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

until nc -z redis 6379; do
  >&2 echo "Redis is unavailable - sleeping"
  sleep 1
done

>&2 echo "Dependencies are up - executing command"
exec $cmd
