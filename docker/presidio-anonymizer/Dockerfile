# Presidio Anonymizer
# Official Microsoft Presidio Anonymizer image with ghcr.io labels

FROM mcr.microsoft.com/presidio-anonymizer:latest

LABEL org.opencontainers.image.source="https://github.com/sourcefuse/CheckUnitTestCases"
LABEL org.opencontainers.image.description="Presidio Anonymizer - PII Anonymization Service"
LABEL org.opencontainers.image.licenses="MIT"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Default port for anonymizer
EXPOSE 5001
