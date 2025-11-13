# Gunicorn configuration file
import multiprocessing
import os

# Server socket
bind = '0.0.0.0:8000'

# Forwarded headers - allow all IPs to trust X-Forwarded-Proto headers
forwarded_allow_ips = '*'

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'gthread'
threads = 3

# Timeouts
timeout = 30
keepalive = 2

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Worker processes
max_requests = 1000
max_requests_jitter = 50
worker_abort = True

# Preload application
preload_app = True

# Graceful shutdown
graceful_timeout = 30

# Debugging
reload = False
reload_engine = 'auto'

# Worker signal handling
def worker_int(worker):
    worker.log.info('Worker received INT or QUIT signal')
    # Get traceback info
    import threading, sys, traceback
    id2name = {th.ident: th.name for th in threading.enumerate()}
    code = []
    for threadId, stack in sys._current_frames().items():
        code.append("\n# Thread: %s(%d)" % (id2name.get(threadId, ""), threadId))
        for filename, lineno, name, line in traceback.extract_stack(stack):
            code.append('File: "%s", line %d, in %s' % (filename, lineno, name))
            if line:
                code.append('  %s' % (line.strip()))
    worker.log.debug("\n".join(code))

def worker_abort(worker):
    worker.log.info('Worker received SIGABRT signal')

# Set environment variables
os.environ['PYTHONUNBUFFERED'] = '1'
