# Combined Presidio Image (Analyzer + Anonymizer)
# Based on official Microsoft Presidio image to avoid SSL/build issues
# Uses supervisord to run both Flask APIs

FROM mcr.microsoft.com/presidio-analyzer:latest AS analyzer
FROM mcr.microsoft.com/presidio-anonymizer:latest AS anonymizer

# Final image based on analyzer (has spaCy model pre-installed)
FROM mcr.microsoft.com/presidio-analyzer:latest

LABEL org.opencontainers.image.source="https://github.com/sourcefuse/CheckUnitTestCases"
LABEL org.opencontainers.image.description="Combined Presidio Analyzer and Anonymizer"

# Install supervisor and anonymizer dependencies
USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install anonymizer package (analyzer image already has common deps)
RUN pip install --no-cache-dir presidio-anonymizer

# Create directories
RUN mkdir -p /var/log/supervisor /app

# Copy Flask API scripts
COPY analyzer_app.py /app/analyzer_app.py
COPY anonymizer_app.py /app/anonymizer_app.py
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5001/health && curl -f http://localhost:5002/health || exit 1

# Expose ports for both services
EXPOSE 5001 5002

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
