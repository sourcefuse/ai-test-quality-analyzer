# Presidio Analyzer
# Official Microsoft Presidio Analyzer image with ghcr.io labels

FROM mcr.microsoft.com/presidio-analyzer:latest

LABEL org.opencontainers.image.source="https://github.com/sourcefuse/CheckUnitTestCases"
LABEL org.opencontainers.image.description="Presidio Analyzer - PII Detection Service"
LABEL org.opencontainers.image.licenses="MIT"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5002/health || exit 1

# Default port for analyzer
EXPOSE 5002
