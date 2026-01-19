# Combined Presidio Image (Analyzer + Anonymizer)
# Runs both official presidio services using supervisord

FROM mcr.microsoft.com/presidio-analyzer:latest

LABEL org.opencontainers.image.source="https://github.com/sourcefuse/CheckUnitTestCases"
LABEL org.opencontainers.image.description="Combined Presidio Analyzer and Anonymizer"

USER root

# Install supervisor, curl, and anonymizer
RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install anonymizer in the poetry environment
RUN poetry install --no-interaction || pip install --no-cache-dir presidio-anonymizer

# Create supervisor directory
RUN mkdir -p /var/log/supervisor

# Copy supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl -f http://localhost:5002/health && curl -f http://localhost:5001/health || exit 1

# Expose ports: 5002 for analyzer, 5001 for anonymizer
EXPOSE 5001 5002

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
