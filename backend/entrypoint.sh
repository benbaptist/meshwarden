#!/bin/sh
set -e
chown meshwarden:meshwarden /data
exec gosu meshwarden python run.py
