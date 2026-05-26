#!/bin/sh
set -e
chown meshwarden:meshwarden /data
exec su-exec meshwarden python run.py
