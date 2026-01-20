# Custom pgvector Image
# Pre-configured PostgreSQL with vector extension
# Optimized for RAG/embedding workloads

FROM ankane/pgvector:latest

LABEL org.opencontainers.image.source="https://github.com/sourcefuse/CheckUnitTestCases"
LABEL org.opencontainers.image.description="PostgreSQL with pgvector for RAG embeddings"

# Set environment defaults
ENV POSTGRES_DB=postgres
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres

# Copy custom initialization scripts
COPY init-extensions.sql /docker-entrypoint-initdb.d/01-init-extensions.sql
COPY init-schema.sql /docker-entrypoint-initdb.d/02-init-schema.sql

# Optimize PostgreSQL for vector operations
COPY postgresql.conf /etc/postgresql/postgresql.conf

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD pg_isready -U postgres || exit 1

EXPOSE 5432
